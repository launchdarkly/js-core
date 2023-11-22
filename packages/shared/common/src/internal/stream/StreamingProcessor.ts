import {
  EventName,
  EventSource,
  HttpErrorResponse,
  LDLogger,
  ProcessStreamResponse,
} from '../../api';
import { LDStreamProcessor } from '../../api/subsystem';
import { LDStreamingError } from '../../errors';
import { httpErrorMessage, shouldRetry } from '../../utils';
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
  errorHandler?.(new LDStreamingError('Malformed JSON data in event stream'));
};

class StreamingProcessor implements LDStreamProcessor {
  private eventSource?: EventSource;
  private connectionAttemptStartTime?: number;

  constructor(
    private readonly createEventSource: () => EventSource,
    private readonly listeners: Map<EventName, ProcessStreamResponse>,
    private readonly diagnosticsManager?: DiagnosticsManager,
    private readonly errorHandler?: StreamingErrorHandler,
    private readonly logger?: LDLogger,
  ) {}

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
  private logAndHandleErrors(err: HttpErrorResponse) {
    if (!shouldRetry(err)) {
      this.logConnectionResult(false);
      this.errorHandler?.(new LDStreamingError(err.message, err.status));
      this.logger?.error(httpErrorMessage(err, 'streaming request'));
      return;
    }

    this.logger?.warn(httpErrorMessage(err, 'streaming request', 'will retry'));
    this.logConnectionResult(false);
    this.logConnectionStarted();
  }

  start() {
    this.logConnectionStarted();

    // TLS is handled by the platform implementation.
    this.eventSource = this.createEventSource();

    this.eventSource.onclose = () => {
      this.logger?.info('Closed LaunchDarkly stream connection');
    };

    this.eventSource.onerror = (err: HttpErrorResponse) => {
      this.logAndHandleErrors(err);
    };

    this.eventSource.onopen = () => {
      this.logger?.info('Opened LaunchDarkly stream connection');
    };

    this.eventSource.onretrying = (e) => {
      this.logger?.info(`Will retry stream connection in ${e.delayMillis} milliseconds`);
    };

    this.listeners.forEach(({ deserializeData, processJson }, eventName) => {
      this.eventSource!.addEventListener(eventName, (event) => {
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
