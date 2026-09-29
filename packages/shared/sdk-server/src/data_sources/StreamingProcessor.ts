import {
  ClientContext,
  classifyHttpStatus,
  classifyTransportFailure,
  EventName,
  EventSource,
  EventSourceRetryDelayStrategy,
  FailureKind,
  forStreaming,
  getStreamingUri,
  httpErrorMessage,
  HttpErrorResponse,
  internal,
  LDHeaders,
  LDLogger,
  ProcessStreamResponse,
  Requests,
  RetryState,
  StreamingErrorHandler,
  subsystem,
} from '@launchdarkly/js-sdk-common';

export default class StreamingProcessor implements subsystem.LDStreamProcessor {
  private readonly _headers: { [key: string]: string | string[] };
  private readonly _streamUri: string;
  private readonly _logger?: LDLogger;
  private readonly _retryState: RetryState;

  private _eventSource?: EventSource;
  private _requests: Requests;
  private _connectionAttemptStartTime?: number;
  private _initHeaders?: { [key: string]: string };
  private _reconnectTimeout?: ReturnType<typeof setTimeout>;
  private _stopped = false;

  constructor(
    clientContext: ClientContext,
    streamUriPath: string,
    parameters: { key: string; value: string }[],
    private readonly _listeners: Map<EventName, ProcessStreamResponse>,
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
    this._retryState = forStreaming(1000 * this._streamInitialReconnectDelay);
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
   * Records a connection failure, logs it, and lets the connection retry. The
   * retry state decides the wait; a server-directed `retry:` value, if any,
   * has already been applied to it through the injected strategy. Every
   * failure is retryable now, so this always returns true.
   *
   * @param err The error to be recorded and logged.
   * @return always true.
   *
   * @private
   */
  private _retryAndHandleError(err: HttpErrorResponse): boolean {
    const kind: FailureKind =
      err.status !== undefined ? classifyHttpStatus(err.status) : classifyTransportFailure();
    this._retryState.recordFailure(kind);
    this._logConnectionResult(false);

    const message = httpErrorMessage(err, 'streaming request', 'will retry');
    // No failure is terminal now, so this is surfaced as a log only — the same
    // outward treatment the SDK has always given a recoverable/interrupted
    // failure. The error-event channel stays reserved for a terminal condition.
    if (kind === 'unexpected') {
      this._logger?.error(message);
    } else {
      this._logger?.warn(message);
    }

    this._logConnectionStarted();
    return true;
  }

  private _restartForInvalidData() {
    // A second invalid payload can arrive in the same parse pass — the event
    // source emits every complete event in a chunk synchronously, even after
    // close(). The first call tears the stream down, so any re-entry finds no
    // live source and must return without scheduling again; otherwise it would
    // orphan the first timer, leak the first EventSource, and duplicate the
    // stream once both reconnects fired.
    if (this._stopped || !this._eventSource) {
      return;
    }

    this._retryState.recordFailure('normal');

    this._eventSource.close();
    this._eventSource = undefined;
    this._reconnectTimeout = setTimeout(() => {
      if (!this._stopped) {
        this.start();
      }
    }, this._retryState.nextDelay);
  }

  start() {
    this._logConnectionStarted();

    const retryDelayStrategy: EventSourceRetryDelayStrategy = {
      nextRetryDelay: () => this._retryState.nextDelay,
      setGoodSince: () => this._retryState.recordSuccess(),
      setBaseDelay: (baseDelayMs: number) => this._retryState.applyServerDirectedRetry(baseDelayMs),
    };

    // TLS is handled by the platform implementation.
    const eventSource = this._requests.createEventSource(this._streamUri, {
      headers: this._headers,
      errorFilter: (error: HttpErrorResponse) => this._retryAndHandleError(error),
      readTimeoutMillis: 5 * 60 * 1000,
      retryDelayStrategy,
    });
    this._eventSource = eventSource;

    eventSource.onclose = () => {
      this._logger?.info('Closed LaunchDarkly stream connection');
    };

    eventSource.onerror = () => {
      // The work is done by `errorFilter`.
    };

    eventSource.onopen = (e) => {
      this._initHeaders = e.headers;
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
          let dataJson;
          try {
            dataJson = deserializeData(data);
          } catch {
            // Structurally invalid data can throw during deserialization; treat
            // it the same as the unparseable payload handled below.
            dataJson = undefined;
          }

          if (!dataJson) {
            this._logger?.error(`Stream received invalid data in "${eventName}" message`);
            this._logger?.debug(`Invalid JSON follows: ${data}`);
            this._restartForInvalidData();
            return;
          }
          processJson(dataJson, this._initHeaders);
        } else {
          this._logger?.error('Unexpected payload from event stream');
          this._restartForInvalidData();
        }
      });
    });
  }

  stop() {
    if (this._reconnectTimeout) {
      clearTimeout(this._reconnectTimeout);
      this._reconnectTimeout = undefined;
    }
    this._stopped = true;
    this._eventSource?.close();
    this._eventSource = undefined;
  }

  close() {
    this.stop();
  }
}
