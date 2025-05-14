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
      dataCallback(payload.basis, payload);
    });

    eventSource.onclose = () => {
      this._logger?.info('Closed LaunchDarkly stream connection');
      statusCallback(subsystemCommon.DataSourceState.Closed);
    };

    eventSource.onerror = () => {
      // The work is done by `errorFilter`.
    };

    eventSource.onopen = () => {
      this._logger?.info('Opened LaunchDarkly stream connection');
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
