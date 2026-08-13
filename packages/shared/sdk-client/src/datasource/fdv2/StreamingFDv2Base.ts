import {
  EventSource,
  getStreamingUri,
  httpErrorMessage,
  HttpErrorResponse,
  internal,
  LDHeaders,
  LDLogger,
  Requests,
  ServiceEndpoints,
  shouldRetry,
} from '@launchdarkly/js-sdk-common';

import { processFlagEval } from '../flagEvalMapper';
import { createAsyncQueue } from './AsyncQueue';
import {
  changeSet,
  errorInfoFromHttpError,
  errorInfoFromInvalidData,
  errorInfoFromNetworkError,
  errorInfoFromUnknown,
  FDv2SourceResult,
  goodbye,
  interrupted,
  shutdown,
  terminalError,
} from './FDv2SourceResult';
import {
  FallbackDirective,
  readFallbackDirective,
  readGoodbyeFallbackDirective,
} from './fallbackDirective';

/**
 * Handler invoked when a legacy `"ping"` event is received on the stream.
 * The implementation should perform an FDv2 poll request (e.g. via
 * {@link poll} from PollingBase) and return the processed result.
 */
export interface PingHandler {
  /** Perform a poll and return the processed result. */
  handlePing(): Promise<FDv2SourceResult>;
}

/**
 * The public surface of the streaming base, used by
 * {@link createStreamingInitializer} and {@link createStreamingSynchronizer}
 * to control the EventSource connection and consume results.
 *
 * @internal
 */
export interface StreamingFDv2Base {
  /** Open the EventSource connection and begin processing events. */
  start(): void;
  /** Close the EventSource connection and queue a shutdown result. */
  close(): void;
  /** Dequeue the next result. Resolves when a result is available. */
  takeResult(): Promise<FDv2SourceResult>;
}

/**
 * FDv2 event names to listen for on the EventSource. This must stay in sync
 * with the `EventType` union defined in `@launchdarkly/js-sdk-common`'s
 * `internal/fdv2/proto.ts`.
 */
const FDV2_EVENT_NAMES: internal.FDv2Event['event'][] = [
  'server-intent',
  'put-object',
  'delete-object',
  'payload-transferred',
  'goodbye',
  'error',
  'heart-beat',
];

/**
 * Creates the core streaming base for FDv2 client-side data sources.
 *
 * Manages an EventSource connection, processes FDv2 protocol events using
 * a protocol handler from the common package, detects FDv1 fallback signals,
 * handles legacy ping events, and queues results for consumption by
 * {@link createStreamingInitializer} or {@link createStreamingSynchronizer}.
 *
 * @internal
 */
export function createStreamingBase(config: {
  requests: Requests;
  serviceEndpoints: ServiceEndpoints;
  streamUriPath: string;
  parameters: { key: string; value: string }[];
  selectorGetter?: () => string | undefined;
  headers: LDHeaders;
  initialRetryDelayMillis: number;
  logger?: LDLogger;
  diagnosticsManager?: internal.DiagnosticsManager;
  pingHandler?: PingHandler;
}): StreamingFDv2Base {
  const resultQueue = createAsyncQueue<FDv2SourceResult>();
  const protocolHandler = internal.createProtocolHandler(
    { 'flag-eval': processFlagEval },
    config.logger,
  );

  const headers: { [key: string]: string | string[] } = { ...config.headers };

  function buildStreamUri(): string {
    const params = [...config.parameters];
    const basis = config.selectorGetter?.();
    if (basis) {
      params.push({ key: 'basis', value: encodeURIComponent(basis) });
    }
    return getStreamingUri(config.serviceEndpoints, config.streamUriPath, params);
  }

  let eventSource: EventSource | undefined;
  let connectionAttemptStartTime: number | undefined;
  let fdv1Fallback = false;
  let fdv1FallbackTtlMs: number | undefined;
  // Directive deferred from a stream `onopen` carrying x-ld-fd-fallback. Promoted
  // into the committed state by resolveFallback() the next time a result is
  // queued, rather than applied immediately, so a payload already in flight on
  // this connection still gets delivered.
  let pendingFallbackTtlMs: number | undefined;
  let pendingFallback = false;
  let started = false;
  let stopped = false;

  function logConnectionAttempt() {
    connectionAttemptStartTime = Date.now();
  }

  function logConnectionResult(success: boolean) {
    if (connectionAttemptStartTime && config.diagnosticsManager) {
      config.diagnosticsManager.recordStreamInit(
        connectionAttemptStartTime,
        !success,
        Date.now() - connectionAttemptStartTime,
      );
    }
    connectionAttemptStartTime = undefined;
  }

  /**
   * Resolves the current fallback directive, optionally overridden by an
   * `incoming` directive from a different source (an in-band goodbye payload
   * or an error-response header). When `incoming` signals fallback, it wins
   * outright - it carries its own TTL, which takes precedence over anything
   * deferred at `onopen`, and the pending pair is cleared since it is now
   * superseded. Otherwise, a directive deferred at `onopen` (`pendingFallback`)
   * is promoted into the committed `fdv1Fallback`/`fdv1FallbackTtlMs` state and
   * the pending pair is cleared. Safe to call with neither; it just returns the
   * current committed state unchanged.
   */
  function resolveFallback(incoming?: FallbackDirective): FallbackDirective {
    if (incoming?.fdv1Fallback) {
      fdv1Fallback = true;
      fdv1FallbackTtlMs = incoming.fdv1FallbackTtlMs;
      pendingFallback = false;
      pendingFallbackTtlMs = undefined;
      return { fdv1Fallback, fdv1FallbackTtlMs };
    }
    if (pendingFallback) {
      fdv1Fallback = true;
      fdv1FallbackTtlMs = pendingFallbackTtlMs;
      pendingFallback = false;
      pendingFallbackTtlMs = undefined;
    }
    return { fdv1Fallback, fdv1FallbackTtlMs };
  }

  /**
   * The single place a result derived from the fallback directive state is
   * enqueued. It resolves the current directive once via `resolveFallback()`
   * - passing `incoming` through when the call site has its own directive
   * source - and hands the result to `build`, which stamps it onto the
   * result. `shutdown()` is the only path with no fallback state to resolve,
   * so it still enqueues directly.
   */
  function putWithFallback(
    build: (fallback: FallbackDirective) => FDv2SourceResult,
    incoming?: FallbackDirective,
  ): void {
    resultQueue.put(build(resolveFallback(incoming)));
  }

  function handleAction(action: internal.ProtocolAction, rawData?: unknown): void {
    switch (action.type) {
      case 'payload':
        logConnectionResult(true);
        putWithFallback((fallback) => changeSet(action.payload, fallback));
        break;

      case 'goodbye': {
        // An in-band fallback signal in the goodbye data (its own TTL) takes
        // precedence over a directive deferred at onopen; putWithFallback()
        // passes it through to resolveFallback() as the incoming override.
        const goodbyeDirective = readGoodbyeFallbackDirective(rawData);
        putWithFallback(
          (fallback) => (fallback.fdv1Fallback
            ? terminalError(errorInfoFromUnknown(action.reason), fallback)
            : goodbye(action.reason, fallback)),
          goodbyeDirective,
        );
        break;
      }

      case 'serverError':
        putWithFallback((fallback) => interrupted(errorInfoFromUnknown(action.reason), fallback));
        break;

      case 'error':
        // Only actionable errors are queued; informational ones (UNKNOWN_EVENT)
        // are logged by the protocol handler.
        if (action.kind === 'MISSING_PAYLOAD' || action.kind === 'PROTOCOL_ERROR') {
          putWithFallback((fallback) => interrupted(errorInfoFromInvalidData(action.message), fallback));
        }
        break;

      case 'none':
      default:
        break;
    }
  }

  function handleError(err: HttpErrorResponse): boolean {
    // Check for FDv1 fallback header (with optional TTL).
    const errHeaders = err.headers ?? {};
    const directive = readFallbackDirective({
      get: (name: string) => errHeaders[name.toLowerCase()] ?? null,
    });
    if (directive.fdv1Fallback) {
      // A fallback directive overrides normal retry handling, even for an
      // otherwise-recoverable HTTP status: the server is telling us to stop
      // trying FDv2 now rather than keep retrying this connection.
      logConnectionResult(false);
      putWithFallback(
        (fallback) => terminalError(errorInfoFromHttpError(err.status ?? 0), fallback),
        directive,
      );
      return false;
    }

    if (!shouldRetry(err)) {
      config.logger?.error(httpErrorMessage(err, 'streaming request'));
      logConnectionResult(false);
      putWithFallback((fallback) => terminalError(errorInfoFromHttpError(err.status ?? 0), fallback));
      return false;
    }

    config.logger?.warn(httpErrorMessage(err, 'streaming request', 'will retry'));
    logConnectionResult(false);
    logConnectionAttempt();
    putWithFallback((fallback) => interrupted(errorInfoFromHttpError(err.status ?? 0), fallback));
    return true;
  }

  function attachFDv2Listeners(es: EventSource): void {
    FDV2_EVENT_NAMES.forEach((eventName) => {
      es.addEventListener(eventName, (event?: { data?: string }) => {
        if (stopped) {
          config.logger?.debug(`Received ${eventName} event after processor was closed. Skipping.`);
          return;
        }

        if (!event?.data) {
          // Some events (e.g. 'error') may legitimately arrive without a body.
          if (eventName !== 'error') {
            config.logger?.warn(`Event from EventStream missing data for "${eventName}".`);
          }
          return;
        }

        config.logger?.debug(`Received ${eventName} event`);

        let parsed: unknown;
        try {
          parsed = JSON.parse(event.data);
        } catch {
          config.logger?.error(
            `Stream received data that was unable to be parsed in "${eventName}" message`,
          );
          config.logger?.debug(`Data follows: ${event.data}`);
          putWithFallback((fallback) =>
            interrupted(errorInfoFromInvalidData('Malformed JSON in EventStream'), fallback),
          );
          return;
        }

        const action = protocolHandler.processEvent({ event: eventName, data: parsed });
        handleAction(action, parsed);
      });
    });
  }

  function attachPingListener(es: EventSource): void {
    es.addEventListener('ping', async () => {
      if (stopped) {
        config.logger?.debug('Ping received after processor was closed. Skipping.');
        return;
      }

      config.logger?.debug('Got PING, going to poll LaunchDarkly for feature flag updates');

      if (!config.pingHandler) {
        config.logger?.warn('Ping event received but no ping handler configured.');
        return;
      }

      try {
        const result = await config.pingHandler.handlePing();
        if (stopped) {
          config.logger?.debug('Ping completed after processor was closed. Skipping processing.');
          return;
        }

        // A poll can succeed with no fallback signal of its own even though
        // a directive was deferred at onopen; override the result in that
        // case so the deferred directive still surfaces. When the poll's own
        // result already signals fallback, keep its flag but backfill the
        // TTL from the deferred directive if the poll didn't carry one.
        // Build a new object rather than mutating the poll's result in place.
        putWithFallback((fallback) => {
          if (!result.fdv1Fallback && fallback.fdv1Fallback) {
            return { ...result, fdv1Fallback: true, fdv1FallbackTtlMs: fallback.fdv1FallbackTtlMs };
          }
          if (result.fdv1Fallback && result.fdv1FallbackTtlMs === undefined) {
            return { ...result, fdv1FallbackTtlMs: fallback.fdv1FallbackTtlMs };
          }
          return result;
        });
      } catch (err: any) {
        if (stopped) {
          return;
        }

        config.logger?.error(`Error handling ping: ${err?.message ?? err}`);
        putWithFallback((fallback) =>
          interrupted(errorInfoFromNetworkError(err?.message ?? 'Error during ping poll'), fallback),
        );
      }
    });
  }

  return {
    start(): void {
      if (started || stopped) {
        return;
      }
      started = true;

      logConnectionAttempt();

      const es = config.requests.createEventSource(buildStreamUri(), {
        headers,
        errorFilter: (error: HttpErrorResponse) => handleError(error),
        initialRetryDelayMillis: config.initialRetryDelayMillis,
        readTimeoutMillis: 5 * 60 * 1000,
        retryResetIntervalMillis: 60 * 1000,
        urlBuilder: buildStreamUri,
      });
      eventSource = es;

      attachFDv2Listeners(es);
      attachPingListener(es);

      es.onclose = () => {
        config.logger?.info('Closed LaunchDarkly stream connection');
      };

      es.onerror = (err?: HttpErrorResponse) => {
        if (stopped) {
          return;
        }

        if (err && typeof err.status === 'number') {
          // This condition will be handled by the error filter.
          return;
        }
        putWithFallback((fallback) =>
          interrupted(errorInfoFromNetworkError(err?.message ?? 'IO Error'), fallback),
        );
      };

      es.onopen = (e?: { headers?: { [key: string]: string } }) => {
        if (stopped) {
          return;
        }
        config.logger?.info('Opened LaunchDarkly stream connection');
        protocolHandler.reset();

        // Reset both the committed and pending directive on every connection
        // open so a reconnect that does not carry the fallback header clears
        // any state from a prior attempt. Resetting the committed flag here
        // does not undo an already-emitted fallback: the result queue is
        // FIFO, so a `fdv1Fallback: true` result queued before this reconnect
        // is always drained before anything this connection queues after it,
        // and the orchestrator closes this instance as soon as it sees that
        // result - any later result from this reconnect is abandoned unread.
        fdv1Fallback = false;
        fdv1FallbackTtlMs = undefined;
        pendingFallback = false;
        pendingFallbackTtlMs = undefined;

        // EventSource implementations that expose response headers can detect
        // FDv1 fallback at connection open. Defer the directive; resolveFallback()
        // applies it to whatever result is queued next, so a payload already
        // in flight is delivered first.
        const openHeaders = e?.headers;
        if (openHeaders) {
          const directive = readFallbackDirective({
            get: (name: string) => openHeaders[name.toLowerCase()] ?? null,
          });
          pendingFallback = directive.fdv1Fallback;
          pendingFallbackTtlMs = directive.fdv1FallbackTtlMs;
        }
      };

      es.onretrying = (e) => {
        config.logger?.info(`Will retry stream connection in ${e.delayMillis} milliseconds`);
      };
    },

    close(): void {
      if (stopped) {
        return;
      }
      stopped = true;
      pendingFallback = false;
      pendingFallbackTtlMs = undefined;
      eventSource?.close();
      eventSource = undefined;
      resultQueue.put(shutdown());
    },

    takeResult(): Promise<FDv2SourceResult> {
      return resultQueue.take();
    },
  };
}
