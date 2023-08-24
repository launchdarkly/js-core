import { EventListener, EventName, EventSource, LDLogger, Requests } from '../../api';
import { LDStreamProcessor } from '../../api/subsystem/LDStreamProcessor';
import { isHttpRecoverable, LDStreamingError } from '../../errors';
import { ClientContext } from '../../options';
import { defaultHeaders, httpErrorMessage } from '../../utils';
import { DiagnosticsManager } from '../diagnostics';

const STREAM_READ_TIMEOUT_MS = 5 * 60 * 1000;
const RETRY_RESET_INTERVAL_MS = 60 * 1000;

/**
 * @internal
 */
export default class StreamingProcessor implements LDStreamProcessor {
  private readonly headers: { [key: string]: string | string[] };
  private readonly streamInitialReconnectDelay: number;
  private readonly streamUri: string;

  private eventSource?: EventSource;
  private logger?: LDLogger;
  private requests: Requests;
  private connectionAttemptStartTime?: number;

  constructor(
    sdkKey: string,
    clientContext: ClientContext,
    private readonly listeners: Map<EventName, EventListener>,
    private readonly diagnosticsManager?: DiagnosticsManager,
  ) {
    const { basicConfiguration, platform } = clientContext;
    const { logger, tags, streamInitialReconnectDelay } = basicConfiguration;
    const { info, requests } = platform;

    this.headers = defaultHeaders(sdkKey, info, tags);
    this.logger = logger;
    this.streamInitialReconnectDelay = streamInitialReconnectDelay ?? 1;
    this.requests = requests;
    this.streamUri = basicConfiguration.serviceEndpoints.streaming;
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

  start(fn?: ((err?: any) => void) | undefined) {
    this.logConnectionStarted();

    const errorFilter = (err: { status: number; message: string }): boolean => {
      if (err.status && !isHttpRecoverable(err.status)) {
        this.logConnectionResult(false);
        fn?.(new LDStreamingError(err.message, err.status));
        this.logger?.error(httpErrorMessage(err, 'streaming request'));
        return false;
      }

      this.logger?.warn(httpErrorMessage(err, 'streaming request', 'will retry'));
      this.logConnectionResult(false);
      this.logConnectionStarted();
      return true;
    };

    // TODO: figure out how to report errors
    // const reportJsonError = (type: string, data: string) => {
    //   this.logger?.error(`Stream received invalid data in "${type}" message`);
    //   this.logger?.debug(`Invalid JSON follows: ${data}`);
    //   fn?.(new LDStreamingError('Malformed JSON data in event stream'));
    // };

    // TLS is handled by the platform implementation.

    const eventSource = this.requests.createEventSource(this.streamUri, {
      headers: this.headers,
      errorFilter,
      initialRetryDelayMillis: 1000 * this.streamInitialReconnectDelay,
      readTimeoutMillis: STREAM_READ_TIMEOUT_MS,
      retryResetIntervalMillis: RETRY_RESET_INTERVAL_MS,
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

    this.listeners.forEach((listener, eventName) => {
      eventSource.addEventListener(eventName, listener);
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
