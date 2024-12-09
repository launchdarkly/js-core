import {
  ClientContext,
  DataSourceErrorKind,
  EventSource,
  getStreamingUri,
  httpErrorMessage,
  HttpErrorResponse,
  internal,
  LDHeaders,
  LDLogger,
  LDStreamingError,
  Requests,
  shouldRetry,
  StreamingErrorHandler,
  subsystem,
} from '@launchdarkly/js-sdk-common';
import { PayloadListener } from '@launchdarkly/js-sdk-common/dist/esm/internal';

import { processFlag, processSegment } from '../store/serialization';

// TODO: consider naming this StreamingDatasource
export default class StreamingProcessorFDv2 implements subsystem.LDStreamProcessor {
  private readonly _headers: { [key: string]: string | string[] };
  private readonly _streamUri: string;
  private readonly _logger?: LDLogger;

  private _eventSource?: EventSource;
  private _requests: Requests;
  private _connectionAttemptStartTime?: number;

  constructor(
    clientContext: ClientContext,
    streamUriPath: string,
    parameters: { key: string; value: string }[],
    private readonly _payloadListener: PayloadListener,
    baseHeaders: LDHeaders,
    private readonly _diagnosticsManager?: internal.DiagnosticsManager,
    private readonly _errorHandler?: StreamingErrorHandler,
    private readonly _streamInitialReconnectDelay = 1,
  ) {
    const { basicConfiguration, platform } = clientContext;
    const { logger } = basicConfiguration;
    const { requests } = platform;

    this._headers = { ...baseHeaders };
    this._logger = logger;
    this._requests = requests;
    this._streamUri = getStreamingUri(
      basicConfiguration.serviceEndpoints,
      streamUriPath,
      parameters,
    );
  }

  private _logConnectionStarted() {
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
  private _retryAndHandleError(err: HttpErrorResponse) {
    if (!shouldRetry(err)) {
      this._logConnectionResult(false);
      this._errorHandler?.(
        new LDStreamingError(DataSourceErrorKind.ErrorResponse, err.message, err.status),
      );
      this._logger?.error(httpErrorMessage(err, 'streaming request'));
      return false;
    }

    this._logger?.warn(httpErrorMessage(err, 'streaming request', 'will retry'));
    this._logConnectionResult(false);
    this._logConnectionStarted();
    return true;
  }

  start() {
    this._logConnectionStarted();

    const eventSource = this._requests.createEventSource(this._streamUri, {
      headers: this._headers,
      errorFilter: (error: HttpErrorResponse) => this._retryAndHandleError(error),
      initialRetryDelayMillis: 1000 * this._streamInitialReconnectDelay,
      readTimeoutMillis: 5 * 60 * 1000,
      retryResetIntervalMillis: 60 * 1000,
    });
    this._eventSource = eventSource;
    const payloadReader = new internal.PayloadReader(
      eventSource,
      {
        flag: processFlag,
        segment: processSegment,
      },
      (errorKind: DataSourceErrorKind, message: string) => {
        this._errorHandler?.(new LDStreamingError(errorKind, message));
      },
    );
    payloadReader.addPayloadListener(() => {
      // TODO: discuss if it is satisfactory to switch from setting connection result on single event to getting a payload. Need
      // to double check the handling in the ServerIntent:none case.  That may not trigger these payload listeners.
      this._logConnectionResult(true);
    });
    payloadReader.addPayloadListener(this._payloadListener);

    eventSource.onclose = () => {
      this._logger?.info('Closed LaunchDarkly stream connection');
    };

    eventSource.onerror = () => {
      // The work is done by `errorFilter`.
    };

    eventSource.onopen = () => {
      this._logger?.info('Opened LaunchDarkly stream connection');
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
