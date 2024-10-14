import {
  DataSourceErrorKind,
  Encoding,
  EventName,
  EventSource,
  getStreamingUri,
  httpErrorMessage,
  HttpErrorResponse,
  internal,
  LDLogger,
  LDStreamingError,
  ProcessStreamResponse,
  Requests,
  shouldRetry,
  subsystem,
} from '@launchdarkly/js-sdk-common';

import { StreamingDataSourceConfig } from './DataSourceConfig';

const reportJsonError = (
  type: string,
  data: string,
  logger?: LDLogger,
  errorHandler?: internal.StreamingErrorHandler,
) => {
  logger?.error(`Stream received invalid data in "${type}" message`);
  logger?.debug(`Invalid JSON follows: ${data}`);
  errorHandler?.(
    new LDStreamingError(DataSourceErrorKind.InvalidData, 'Malformed JSON data in event stream'),
  );
};

class StreamingProcessor implements subsystem.LDStreamProcessor {
  private readonly _headers: { [key: string]: string | string[] };
  private readonly _streamUri: string;

  private _eventSource?: EventSource;
  private _connectionAttemptStartTime?: number;

  constructor(
    private readonly _plainContextString: string,
    private readonly _dataSourceConfig: StreamingDataSourceConfig,
    private readonly _listeners: Map<EventName, ProcessStreamResponse>,
    private readonly _requests: Requests,
    encoding: Encoding,
    private readonly _diagnosticsManager?: internal.DiagnosticsManager,
    private readonly _errorHandler?: internal.StreamingErrorHandler,
    private readonly _logger?: LDLogger,
  ) {
    // TODO: SC-255969 Implement better REPORT fallback logic
    if (_dataSourceConfig.useReport && !_requests.getEventSourceCapabilities().customMethod) {
      _logger?.error(
        "Configuration option useReport is true, but platform's EventSource does not support custom HTTP methods. Streaming may not work.",
      );
    }

    const path = _dataSourceConfig.useReport
      ? _dataSourceConfig.paths.pathReport(encoding, _plainContextString)
      : _dataSourceConfig.paths.pathGet(encoding, _plainContextString);

    const parameters: { key: string; value: string }[] = [
      ...(_dataSourceConfig.queryParameters ?? []),
    ];
    if (this._dataSourceConfig.withReasons) {
      parameters.push({ key: 'withReasons', value: 'true' });
    }

    this._requests = _requests;
    this._headers = { ..._dataSourceConfig.baseHeaders };
    this._logger = _logger;
    this._streamUri = getStreamingUri(_dataSourceConfig.serviceEndpoints, path, parameters);
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
        new LDStreamingError(DataSourceErrorKind.ErrorResponse, err.message, err.status, false),
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

    let methodAndBodyOverrides;
    if (this._dataSourceConfig.useReport) {
      // REPORT will include a body, so content type is required.
      this._headers['content-type'] = 'application/json';

      // orverrides default method with REPORT and adds body.
      methodAndBodyOverrides = { method: 'REPORT', body: this._plainContextString };
    } else {
      // no method or body override
      methodAndBodyOverrides = {};
    }

    // TLS is handled by the platform implementation.
    const eventSource = this._requests.createEventSource(this._streamUri, {
      headers: this._headers, // adds content-type header required when body will be present
      ...methodAndBodyOverrides,
      errorFilter: (error: HttpErrorResponse) => this._retryAndHandleError(error),
      initialRetryDelayMillis: this._dataSourceConfig.initialRetryDelayMillis,
      readTimeoutMillis: 5 * 60 * 1000,
      retryResetIntervalMillis: 60 * 1000,
    });
    this._eventSource = eventSource;

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

    this._listeners.forEach(({ deserializeData, processJson }, eventName) => {
      eventSource.addEventListener(eventName, (event) => {
        this._logger?.debug(`Received ${eventName} event`);

        if (event?.data) {
          this._logConnectionResult(true);
          const { data } = event;
          const dataJson = deserializeData(data);

          if (!dataJson) {
            reportJsonError(eventName, data, this._logger, this._errorHandler);
            return;
          }
          processJson(dataJson);
        } else {
          this._errorHandler?.(
            new LDStreamingError(
              DataSourceErrorKind.InvalidData,
              'Unexpected payload from event stream',
            ),
          );
        }
      });
    });
  }

  stop() {
    this._eventSource?.close();
    this._eventSource = undefined;
  }

  close() {
    this.stop();
  }
}

export default StreamingProcessor;
