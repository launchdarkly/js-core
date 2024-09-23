import {
  EventName,
  EventSource,
  HttpErrorResponse,
  LDLogger,
  ProcessStreamResponse,
  Requests,
} from '../../api';
import { LDStreamProcessor } from '../../api/subsystem';
import { ClientContext } from '../../options';
import { getStreamingUri } from '../../options/ServiceEndpoints';
import { httpErrorMessage, LDHeaders, shouldRetry } from '../../utils';
import { DataSourceErrorKind } from '../datasource/DataSourceErrorKinds';
import { LDStreamingError, StreamingErrorHandler } from '../datasource/errors';
import { DiagnosticsManager } from '../diagnostics';

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
  private readonly headers: { [key: string]: string | string[] };
  private readonly streamUri: string;
  private readonly logger?: LDLogger;

  private eventSource?: EventSource;
  private requests: Requests;
  private connectionAttemptStartTime?: number;

  constructor(
    clientContext: ClientContext,
    streamUriPath: string,
    parameters: { key: string; value: string }[],
    private readonly listeners: Map<EventName, ProcessStreamResponse>,
    baseHeaders: LDHeaders,
    private readonly diagnosticsManager?: DiagnosticsManager,
    private readonly errorHandler?: StreamingErrorHandler,
    private readonly streamInitialReconnectDelay = 1,
  ) {
    const { basicConfiguration, platform } = clientContext;
    const { logger } = basicConfiguration;
    const { requests } = platform;

    this.headers = { ...baseHeaders };
    this.logger = logger;
    this.requests = requests;
    this.streamUri = getStreamingUri(
      basicConfiguration.serviceEndpoints,
      streamUriPath,
      parameters,
    );
  }

  private logConnectionStarted() {
    this.connectionAttemptStartTime = Date.now();
  }

  private logConnectionResult(success: boolean) {
    if (this.connectionAttemptStartTime && this.diagnosticsManager) {
      this.diagnosticsManager.recordStreamInit(
        this.connectionAttemptStartTime,
        !success,
        Date.now() - this.connectionAttemptStartTime,
      );
    }

    this.connectionAttemptStartTime = undefined;
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
  private retryAndHandleError(err: HttpErrorResponse) {
    if (!shouldRetry(err)) {
      this.logConnectionResult(false);
      this.errorHandler?.(
        new LDStreamingError(DataSourceErrorKind.ErrorResponse, err.message, err.status),
      );
      this.logger?.error(httpErrorMessage(err, 'streaming request'));
      return false;
    }

    this.logger?.warn(httpErrorMessage(err, 'streaming request', 'will retry'));
    this.logConnectionResult(false);
    this.logConnectionStarted();
    return true;
  }

  start() {
    this.logConnectionStarted();

    // TLS is handled by the platform implementation.
    const eventSource = this.requests.createEventSource(this.streamUri, {
      headers: this.headers,
      errorFilter: (error: HttpErrorResponse) => this.retryAndHandleError(error),
      initialRetryDelayMillis: 1000 * this.streamInitialReconnectDelay,
      readTimeoutMillis: 5 * 60 * 1000,
      retryResetIntervalMillis: 60 * 1000,
    });
    this.eventSource = eventSource;

    eventSource.onclose = () => {
      this.logger?.info('Closed LaunchDarkly stream connection');
    };

    eventSource.onerror = () => {
      // The work is done by `errorFilter`.
    };

    eventSource.onopen = () => {
      this.logger?.info('Opened LaunchDarkly stream connection');
    };

    eventSource.onretrying = (e) => {
      this.logger?.info(`Will retry stream connection in ${e.delayMillis} milliseconds`);
    };

    this.listeners.forEach(({ deserializeData, processJson }, eventName) => {
      eventSource.addEventListener(eventName, (event) => {
        this.logger?.debug(`Received ${eventName} event`);

        if (event?.data) {
          this.logConnectionResult(true);
          const { data } = event;
          const dataJson = deserializeData(data);

          if (!dataJson) {
            reportJsonError(eventName, data, this.logger, this.errorHandler);
            return;
          }
          processJson(dataJson);
        } else {
          this.errorHandler?.(
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
    this.eventSource?.close();
    this.eventSource = undefined;
  }

  close() {
    this.stop();
  }
}

export default StreamingProcessor;
