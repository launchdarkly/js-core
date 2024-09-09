import {
  defaultHeaders,
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
  errorHandler?.(new LDStreamingError('Malformed JSON data in event stream'));
};

class StreamingProcessor implements subsystem.LDStreamProcessor {
  private readonly headers: { [key: string]: string | string[] };
  private readonly streamUri: string;

  private eventSource?: EventSource;
  private connectionAttemptStartTime?: number;

  constructor(
    private readonly plainContextString: string,
    private readonly dataSourceConfig: StreamingDataSourceConfig,
    private readonly listeners: Map<EventName, ProcessStreamResponse>,
    private readonly requests: Requests,
    encoding: Encoding,
    private readonly diagnosticsManager?: internal.DiagnosticsManager,
    private readonly errorHandler?: internal.StreamingErrorHandler,
    private readonly logger?: LDLogger,
  ) {
    const path = dataSourceConfig.useReport
      ? dataSourceConfig.paths.pathReport(encoding, dataSourceConfig.credential, plainContextString)
      : dataSourceConfig.paths.pathGet(encoding, dataSourceConfig.credential, plainContextString);

    const parameters: { key: string; value: string }[] = [];
    if (this.dataSourceConfig.withReasons) {
      parameters.push({ key: 'withReasons', value: 'true' });
    }

    this.headers = defaultHeaders(
      dataSourceConfig.credential,
      dataSourceConfig.info,
      dataSourceConfig.tags,
    );

    this.logger = logger;
    this.requests = requests;
    this.streamUri = getStreamingUri(dataSourceConfig.serviceEndpoints, path, parameters);
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
      ...(this.dataSourceConfig.useReport && { method: 'REPORT', body: this.plainContextString }),
      errorFilter: (error: HttpErrorResponse) => this.retryAndHandleError(error),
      initialRetryDelayMillis: this.dataSourceConfig.initialRetryDelayMillis,
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
