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
 * The public surface of the streaming base — used by
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
  headers: LDHeaders;
  initialRetryDelayMillis: number;
  logger?: LDLogger;
  diagnosticsManager?: internal.DiagnosticsManager;
  pingHandler?: PingHandler;
}): StreamingFDv2Base {
  const resultQueue = createAsyncQueue<FDv2SourceResult>();
  const protocolHandler = internal.createProtocolHandler(
    { flagEval: processFlagEval },
    config.logger,
  );

  const streamUri = getStreamingUri(
    config.serviceEndpoints,
    config.streamUriPath,
    config.parameters,
  );
  const headers: { [key: string]: string | string[] } = { ...config.headers };

  let eventSource: EventSource | undefined;
  let connectionAttemptStartTime: number | undefined;
  let fdv1Fallback = false;
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

  function handleAction(action: internal.ProtocolAction): void {
    switch (action.type) {
      case 'payload':
        logConnectionResult(true);
        resultQueue.put(changeSet(action.payload, fdv1Fallback));
        break;

      case 'goodbye':
        resultQueue.put(goodbye(action.reason, fdv1Fallback));
        break;

      case 'serverError':
        resultQueue.put(interrupted(errorInfoFromUnknown(action.reason), fdv1Fallback));
        break;

      case 'error':
        // Only actionable errors are queued; informational ones (UNKNOWN_EVENT)
        // are logged by the protocol handler.
        if (action.kind === 'MISSING_PAYLOAD' || action.kind === 'PROTOCOL_ERROR') {
          resultQueue.put(interrupted(errorInfoFromInvalidData(action.message), fdv1Fallback));
        }
        break;

      case 'none':
      default:
        break;
    }
  }

  function handleError(err: HttpErrorResponse): boolean {
    // Check for FDv1 fallback header.
    if (err.headers?.['x-ld-fd-fallback'] === 'true') {
      fdv1Fallback = true;
      logConnectionResult(false);
      resultQueue.put(terminalError(errorInfoFromHttpError(err.status ?? 0), true));
      return false;
    }

    if (!shouldRetry(err)) {
      config.logger?.error(httpErrorMessage(err, 'streaming request'));
      logConnectionResult(false);
      resultQueue.put(terminalError(errorInfoFromHttpError(err.status ?? 0), fdv1Fallback));
      return false;
    }

    config.logger?.warn(httpErrorMessage(err, 'streaming request', 'will retry'));
    logConnectionResult(false);
    logConnectionAttempt();
    resultQueue.put(interrupted(errorInfoFromHttpError(err.status ?? 0), fdv1Fallback));
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
          config.logger?.warn(`Event from EventStream missing data for "${eventName}".`);
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
          resultQueue.put(
            interrupted(errorInfoFromInvalidData('Malformed JSON in EventStream'), fdv1Fallback),
          );
          return;
        }

        const action = protocolHandler.processEvent({ event: eventName, data: parsed });
        handleAction(action);
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

        resultQueue.put(result);
      } catch (err: any) {
        if (stopped) {
          return;
        }

        config.logger?.error(`Error handling ping: ${err?.message ?? err}`);
        resultQueue.put(
          interrupted(
            errorInfoFromNetworkError(err?.message ?? 'Error during ping poll'),
            fdv1Fallback,
          ),
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

      const es = config.requests.createEventSource(streamUri, {
        headers,
        errorFilter: (error: HttpErrorResponse) => handleError(error),
        initialRetryDelayMillis: config.initialRetryDelayMillis,
        readTimeoutMillis: 5 * 60 * 1000,
        retryResetIntervalMillis: 60 * 1000,
      });
      eventSource = es;

      attachFDv2Listeners(es);
      attachPingListener(es);

      es.onclose = () => {
        config.logger?.info('Closed LaunchDarkly stream connection');
      };

      es.onerror = () => {
        // Error handling is done by errorFilter.
      };

      es.onopen = () => {
        config.logger?.info('Opened LaunchDarkly stream connection');
        protocolHandler.reset();
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
      eventSource?.close();
      eventSource = undefined;
      resultQueue.put(shutdown());
    },

    takeResult(): Promise<FDv2SourceResult> {
      return resultQueue.take();
    },
  };
}
