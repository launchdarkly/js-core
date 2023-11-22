import {
  EventName,
  EventSource,
  HttpErrorResponse,
  LDLogger,
  ProcessStreamResponse,
  Requests,
} from '../../api';
import { LDStreamProcessor } from '../../api/subsystem';
import { isHttpRecoverable, LDStreamingError } from '../../errors';
import { ClientContext } from '../../options';
import { defaultHeaders, httpErrorMessage } from '../../utils';
import { DiagnosticsManager } from '../diagnostics';
import { StreamingErrorHandler } from './types';

const STREAM_READ_TIMEOUT_MS = 5 * 60 * 1000;
const RETRY_RESET_INTERVAL_MS = 60 * 1000;

const reportJsonError = (
  type: string,
  data: string,
  logger?: LDLogger,
  errorHandler?: StreamingErrorHandler,
) => {
  logger?.error(`Stream received invalid data in "${type}" message`);
  logger?.debug(`Invalid JSON follows: ${data}`);
  errorHandler?.(new LDStreamingError('Malformed JSON data in event stream'));
};

class StreamingProcessor implements LDStreamProcessor {
  private readonly headers: { [key: string]: string | string[] };
  private readonly streamUri: string;
  private readonly logger?: LDLogger;

  private eventSource?: EventSource;
  private requests: Requests;
  private connectionAttemptStartTime?: number;

  constructor(
    sdkKey: string,
    clientContext: ClientContext,
    streamUriPath: string,
    private readonly listeners: Map<EventName, ProcessStreamResponse>,
    private readonly diagnosticsManager?: DiagnosticsManager,
    private readonly errorHandler?: StreamingErrorHandler,
    private readonly streamInitialReconnectDelay = 1,
  ) {
    const { basicConfiguration, platform } = clientContext;
    const { logger, tags } = basicConfiguration;
    const { info, requests } = platform;

    this.headers = defaultHeaders(sdkKey, info, tags);
    this.logger = logger;
    this.requests = requests;
    this.streamUri = `${basicConfiguration.serviceEndpoints.streaming}${streamUriPath}`;
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
   * @param err The error to be logged and handled
   * @private
   * @return boolean whether to retry the connection.
   */
  private logAndHandleErrors(err: HttpErrorResponse): boolean {
    if (err.status && !isHttpRecoverable(err.status)) {
      this.logConnectionResult(false);
      this.errorHandler?.(new LDStreamingError(err.message, err.status));
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
      errorFilter: (err: HttpErrorResponse) => this.logAndHandleErrors(err),
      initialRetryDelayMillis: 1000 * this.streamInitialReconnectDelay,
      readTimeoutMillis: STREAM_READ_TIMEOUT_MS,
      retryResetIntervalMillis: RETRY_RESET_INTERVAL_MS,
    });
    this.eventSource = eventSource;

    eventSource.onclose = () => {
      this.logger?.info('Closed LaunchDarkly stream connection');
    };

    eventSource.onerror = (err: HttpErrorResponse) => {
      this.logAndHandleErrors(err);
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
          this.errorHandler?.(new LDStreamingError('Unexpected payload from event stream'));
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
