import { EventName, EventSource, LDLogger, ProcessStreamResponse } from '../../api';
import { LDStreamProcessor } from '../../api/subsystem';
import { isHttpRecoverable, LDStreamingError } from '../../errors';
import { httpErrorMessage } from '../../utils';
import { DiagnosticsManager } from '../diagnostics';
import { ErrorFilterFunction, StreamingErrorHandler } from './types';

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
  private connectionAttemptStartTime?: number;
  eventSource?: EventSource;

  constructor(
    private readonly makeEventSource: (errorFilter?: ErrorFilterFunction) => EventSource,
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

  errorFilter(err: { status: number; message: string }): boolean {
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
    this.eventSource = this.makeEventSource(this.errorFilter);

    this.eventSource.onclose = () => {
      this.logger?.info('Closed LaunchDarkly stream connection');
    };

    this.eventSource.onerror = (err: any) => {
      this.logger?.error(`Streaming error: ${err}`);
    };

    this.eventSource.onopen = () => {
      this.logger?.info('Opened LaunchDarkly stream connection');
    };

    this.eventSource.onretrying = (e) => {
      this.logger?.info(`Will retry stream connection in ${e.delayMillis} milliseconds`);
    };

    this.listeners.forEach(({ deserializeData, processJson }, eventName) => {
      this.eventSource?.addEventListener(eventName, (event) => {
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
