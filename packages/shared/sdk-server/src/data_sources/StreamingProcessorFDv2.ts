import {
  ClientContext,
  DataSourceErrorKind,
  EventSource,
  getStreamingUri,
  httpErrorMessage,
  HttpErrorResponse,
  internal,
  LDFlagDeliveryFallbackError,
  LDHeaders,
  LDLogger,
  LDStreamingError,
  Requests,
  ServiceEndpoints,
  shouldRetry,
  subsystem as subsystemCommon,
} from '@launchdarkly/js-sdk-common';

import { Flag } from '../evaluation/data/Flag';
import { Segment } from '../evaluation/data/Segment';
import { processFlag, processSegment } from '../store/serialization';

export default class StreamingProcessorFDv2 implements subsystemCommon.DataSource {
  private readonly _serviceEndpoints: ServiceEndpoints;
  private readonly _headers: { [key: string]: string | string[] };
  private readonly _logger?: LDLogger;

  private _eventSource?: EventSource;
  private _requests: Requests;
  private _connectionAttemptStartTime?: number;

  // init metadata from start of connection will be held and then
  // included with each payload update so consumers have access to it
  private _initMetadata?: internal.InitMetadata;

  constructor(
    clientContext: ClientContext,
    private readonly _streamUriPath: string,
    private readonly _parameters: { key: string; value: string }[],
    baseHeaders: LDHeaders,
    private readonly _diagnosticsManager?: internal.DiagnosticsManager,
    private readonly _streamInitialReconnectDelay = 1,
  ) {
    const { basicConfiguration, platform } = clientContext;
    const { logger, serviceEndpoints } = basicConfiguration;
    const { requests } = platform;

    this._headers = { ...baseHeaders };
    this._serviceEndpoints = serviceEndpoints;
    this._logger = logger;
    this._requests = requests;
  }

  private _logConnectionAttempt() {
    this._connectionAttemptStartTime = Date.now();
  }

  private _logConnectionResult(success: boolean) {
    if (this._connectionAttemptStartTime && this._diagnosticsManager) {
      this._diagnosticsManager.recordStreamInit(
        this._connectionAttemptStartTime,
        !success,
        Date.now() - this._connectionAttemptStartTime,
      );
    }

    this._connectionAttemptStartTime = undefined;
  }

  /**
   * This is a wrapper around the passed errorHandler which adds additional
   * diagnostics and logging logic.
   *
   * @param err The error to be logged and handled.
   * @return boolean whether to retry the connection.
   *
   * @private
   */
  private _retryAndHandleError(
    err: HttpErrorResponse,
    statusCallback: (status: subsystemCommon.DataSourceState, err?: any) => void,
  ) {
    // this is a short term error and will be removed once FDv2 adoption is sufficient.
    if (err.headers?.[`x-ld-fd-fallback`] === `true`) {
      const fallbackErr = new LDFlagDeliveryFallbackError(
        DataSourceErrorKind.ErrorResponse,
        `Response header indicates to fallback to FDv1`,
        err.status,
      );
      statusCallback(subsystemCommon.DataSourceState.Closed, fallbackErr);
      return false;
    }

    if (!shouldRetry(err)) {
      this._logger?.error(httpErrorMessage(err, 'streaming request'));
      this._logConnectionResult(false);
      statusCallback(
        subsystemCommon.DataSourceState.Closed,
        new LDStreamingError(DataSourceErrorKind.ErrorResponse, err.message, err.status, false),
      );
      return false;
    }

    this._logger?.warn(httpErrorMessage(err, 'streaming request', 'will retry'));
    this._logConnectionResult(false);
    this._logConnectionAttempt();
    statusCallback(subsystemCommon.DataSourceState.Interrupted);
    return true;
  }

  start(
    dataCallback: (basis: boolean, data: any) => void,
    statusCallback: (status: subsystemCommon.DataSourceState, err?: any) => void,
    selectorGetter?: () => string | undefined,
  ) {
    this._logConnectionAttempt();
    statusCallback(subsystemCommon.DataSourceState.Initializing);

    const selector = selectorGetter?.();
    const params = selector
      ? [...this._parameters, { key: 'basis', value: selector }] // if selector exists add basis parameter
      : this._parameters; // otherwise use params as is

    const uri = getStreamingUri(this._serviceEndpoints, this._streamUriPath, params);
    this._logger?.debug(`Streaming processor opening event source to uri: ${uri}`);

    // Set when the most recent successful connection carried `x-ld-fd-fallback: true`. We
    // finish applying the next payload before emitting the fallback signal so evaluations
    // can serve the server-provided data while the FDv1 synchronizer takes over.
    let fallbackRequested = false;

    const eventSource = this._requests.createEventSource(uri, {
      headers: this._headers,
      errorFilter: (error: HttpErrorResponse) => this._retryAndHandleError(error, statusCallback),
      initialRetryDelayMillis: 1000 * this._streamInitialReconnectDelay,
      readTimeoutMillis: 5 * 60 * 1000,
      retryResetIntervalMillis: 60 * 1000,
    });
    this._eventSource = eventSource;
    const payloadReader = new internal.PayloadStreamReader(
      eventSource,
      {
        flag: (flag: Flag) => {
          processFlag(flag);
          return flag;
        },
        segment: (segment: Segment) => {
          processSegment(segment);
          return segment;
        },
      },
      (errorKind: DataSourceErrorKind, message: string) => {
        statusCallback(
          subsystemCommon.DataSourceState.Interrupted,
          new LDStreamingError(errorKind, message),
        );

        // parsing error was encountered, defensively close the data source
        this.stop();
      },
      this._logger,
    );
    payloadReader.addPayloadListener((payload) => {
      this._logConnectionResult(true);

      // The server may signal FDv1 fallback alongside a valid streaming payload via the
      // response headers on the initial connection. Attach a fallbackToFDv1 marker to the
      // data callback so the directive is delivered atomically with the payload --
      // CompositeDataSource will swap its synchronizer list to FDv1 before resolving the
      // switchToSync transition. A separate status callback after the data callback would
      // be silently dropped because the basis-during-init auto-transition disables the
      // composite's callback handler.
      const data: { initMetadata: any; payload: any; fallbackToFDv1?: boolean } = {
        initMetadata: this._initMetadata,
        payload,
      };
      if (fallbackRequested) {
        data.fallbackToFDv1 = true;
        this._logger?.warn(`Response header indicates to fallback to FDv1`);
      }
      dataCallback(payload.type === 'full', data);

      if (fallbackRequested) {
        // Stop consuming the FDv2 stream now that the directive has been delivered.
        this.stop();
      }
    });

    eventSource.onclose = () => {
      this._logger?.info('Closed LaunchDarkly stream connection');
      statusCallback(subsystemCommon.DataSourceState.Closed);
    };

    eventSource.onerror = () => {
      // The work is done by `errorFilter`.
    };

    eventSource.onopen = (e) => {
      this._logger?.info('Opened LaunchDarkly stream connection');
      this._initMetadata = internal.initMetadataFromHeaders(e.headers);
      // The fallback signal is captured here from the connection-open response headers and
      // is honored by the payload listener above once the next payload has been applied.
      if (e.headers?.[`x-ld-fd-fallback`] === `true`) {
        fallbackRequested = true;
      }
      statusCallback(subsystemCommon.DataSourceState.Valid);
    };

    eventSource.onretrying = (e) => {
      this._logger?.info(`Will retry stream connection in ${e.delayMillis} milliseconds`);
    };
  }

  stop() {
    this._eventSource?.close();
    this._eventSource = undefined;
  }

  close() {
    this.stop();
  }
}
