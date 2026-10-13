import {
  classifyHttpStatus,
  DataSourceErrorKind,
  Encoding,
  EventName,
  EventSource,
  EventSourceRetryDelayStrategy,
  forStreaming,
  getStreamingUri,
  httpErrorMessage,
  HttpErrorResponse,
  internal,
  LDLogger,
  LDPollingError,
  LDStreamingError,
  ProcessStreamResponse,
  Requests,
  RetryState,
  StreamingErrorHandler,
  subsystem,
} from '@launchdarkly/js-sdk-common';

import { StreamingDataSourceConfig } from '../datasource/DataSourceConfig';
import { LDRequestError, Requestor } from '../datasource/Requestor';

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

function reportEventClosed(eventName: string, logger?: LDLogger) {
  logger?.debug(`Received ${eventName} event after processor was closed. Skipping processing.`);
}

function reportPingClosed(logger?: LDLogger) {
  logger?.debug('Ping completed after processor was closed. Skipping processing.');
}

class StreamingProcessor implements subsystem.LDStreamProcessor {
  private readonly _headers: { [key: string]: string | string[] };
  private readonly _streamUri: string;

  private _eventSource?: EventSource;
  private _connectionAttemptStartTime?: number;
  private _stopped = false;
  private readonly _retryState: RetryState;

  constructor(
    private readonly _plainContextString: string,
    private readonly _dataSourceConfig: StreamingDataSourceConfig,
    private readonly _listeners: Map<EventName, ProcessStreamResponse>,
    private readonly _requests: Requests,
    encoding: Encoding,
    private readonly _pollingRequestor: Requestor,
    private readonly _diagnosticsManager?: internal.DiagnosticsManager,
    private readonly _errorHandler?: StreamingErrorHandler,
    private readonly _logger?: LDLogger,
  ) {
    let path: string;
    if (_dataSourceConfig.useReport && !_requests.getEventSourceCapabilities().customMethod) {
      path = _dataSourceConfig.paths.pathPing(encoding, _plainContextString);
    } else {
      path = _dataSourceConfig.useReport
        ? _dataSourceConfig.paths.pathReport(encoding, _plainContextString)
        : _dataSourceConfig.paths.pathGet(encoding, _plainContextString);
    }
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
    this._retryState = forStreaming(this._dataSourceConfig.initialRetryDelayMillis);
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
   * Records a connection failure on the retry-state controller and surfaces it
   * for logging and diagnostics. No failure is terminal now: the connection is
   * always retried. An unexpected failure (e.g. 401/403) backs off into the
   * extended regime but still retries, so it is surfaced to the error handler
   * without stopping.
   *
   * @param err The error to be logged and handled.
   * @private
   */
  private _retryAndHandleError(err: HttpErrorResponse) {
    const failureKind = err.status !== undefined ? classifyHttpStatus(err.status) : 'normal';
    this._retryState.recordFailure(failureKind);

    if (failureKind === 'unexpected') {
      this._logger?.error(httpErrorMessage(err, 'streaming request', 'will retry'));
      this._errorHandler?.(
        new LDStreamingError(DataSourceErrorKind.ErrorResponse, err.message, err.status),
      );
    } else {
      this._logger?.warn(httpErrorMessage(err, 'streaming request', 'will retry'));
    }

    this._logConnectionResult(false);
    this._logConnectionStarted();
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

    // The data source drives reconnection timing from its own retry state via
    // the injected strategy. initialRetryDelayMillis / retryResetIntervalMillis
    // remain as the fallback for transports that do not honor an injected
    // strategy (e.g. the browser's native EventSource).
    const retryDelayStrategy: EventSourceRetryDelayStrategy = {
      nextRetryDelay: () => this._retryState.nextDelay,
      setGoodSince: () => this._retryState.recordSuccess(),
      setBaseDelay: (baseDelayMs: number) => this._retryState.applyServerDirectedRetry(baseDelayMs),
    };

    // TLS is handled by the platform implementation.
    const eventSource = this._requests.createEventSource(this._streamUri, {
      headers: this._headers, // adds content-type header required when body will be present
      ...methodAndBodyOverrides,
      errorFilter: (error: HttpErrorResponse) => {
        this._retryAndHandleError(error);
        return true;
      },
      initialRetryDelayMillis: this._dataSourceConfig.initialRetryDelayMillis,
      readTimeoutMillis: 5 * 60 * 1000,
      retryResetIntervalMillis: 60 * 1000,
      retryDelayStrategy,
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
        // If an event comes in after the processor has been stopped, we skip processing it.
        // This event could be for a context which is no longer active.
        if (this._stopped) {
          reportEventClosed(eventName, this._logger);
          return;
        }

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

    // here we set up a listener that will poll when ping is received
    eventSource.addEventListener('ping', async () => {
      this._logger?.debug('Got PING, going to poll LaunchDarkly for feature flag updates');
      try {
        const res = await this._pollingRequestor.requestPayload();
        try {
          // If the ping completes after the processor has been stopped, then we discard it.
          // This event could be for a context which is no longer active.
          if (this._stopped) {
            reportPingClosed(this._logger);
            return;
          }
          const payload = JSON.parse(res);
          try {
            // forward the payload on to the PUT listener
            this._listeners.get('put')?.processJson(payload);
          } catch (err) {
            this._logger?.error(`Exception from data handler: ${err}`);
          }
        } catch {
          this._logger?.error('Polling after ping received invalid data');
          this._logger?.debug(`Invalid JSON follows: ${res}`);
          this._errorHandler?.(
            new LDPollingError(
              DataSourceErrorKind.InvalidData,
              'Malformed JSON data in ping polling response',
            ),
          );
        }
      } catch (err) {
        if (this._stopped) {
          // If the ping errors after the processor has been stopped, then we discard it.
          // The original caller would consider this connection no longer active.
          reportPingClosed(this._logger);
          return;
        }
        const requestError = err as LDRequestError;
        this._errorHandler?.(
          new LDPollingError(
            DataSourceErrorKind.ErrorResponse,
            requestError.message,
            requestError.status,
          ),
        );
      }
    });
  }

  stop() {
    this._eventSource?.close();
    this._eventSource = undefined;
    this._stopped = true;
  }

  close() {
    this.stop();
  }
}

export default StreamingProcessor;
