import {
  EventName,
  EventSource,
  HttpErrorResponse,
  LDLogger,
  ProcessStreamResponse,
  Requests,
} from '../../api';
import { LDStreamProcessor } from '../../api/subsystem';
import { DataSourceErrorKind } from '../../datasource/DataSourceErrorKinds';
import { LDStreamingError } from '../../datasource/errors';
import { ClientContext } from '../../options';
import { getStreamingUri } from '../../options/ServiceEndpoints';
import { httpErrorMessage, LDHeaders, shouldRetry } from '../../utils';
import { DiagnosticsManager } from '../diagnostics';
import { StreamingErrorHandler } from './types';

const reportJsonError = (
  type: string,
  data: string,
  logger?: LDLogger,
  errorHandler?: StreamingErrorHandler,
) => {
  logger?.error(`Stream received invalid data in "${type}" message`);
  logger?.debug(`Invalid JSON follows: ${data}`);
  errorHandler?.(
    new LDStreamingError(DataSourceErrorKind.InvalidData, 'Malformed JSON data in event stream'),
  );
};

// TODO: SDK-156 - Move to Server SDK specific location
class StreamingProcessor implements LDStreamProcessor {
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
    private readonly _listeners: Map<EventName, ProcessStreamResponse>,
    baseHeaders: LDHeaders,
    private readonly _diagnosticsManager?: DiagnosticsManager,
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

    // TLS is handled by the platform implementation.
    const eventSource = this._requests.createEventSource(this._streamUri, {
      headers: this._headers,
      errorFilter: (error: HttpErrorResponse) => this._retryAndHandleError(error),
      initialRetryDelayMillis: 1000 * this._streamInitialReconnectDelay,
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
              DataSourceErrorKind.Unknown,
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
