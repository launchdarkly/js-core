import {
  httpErrorMessage,
  HttpErrorResponse,
  internal,
  isHttpRecoverable,
  LDLogger,
} from '@launchdarkly/js-sdk-common';

import { Flags } from '../../types';
import { LDRequestError, Requestor } from '../Requestor';
import { createAsyncQueue } from './AsyncQueue';
import {
  changeSet,
  errorInfoFromHttpError,
  errorInfoFromInvalidData,
  errorInfoFromNetworkError,
  FDv2SourceResult,
  shutdown,
  terminalError,
} from './FDv2SourceResult';
import { Synchronizer } from './Synchronizer';

const PAYLOAD_ID = 'FDv1Fallback';

function flagsToPayload(flags: Flags): internal.Payload {
  const updates: internal.Update[] = Object.entries(flags).map(([key, flag]) => ({
    kind: 'flag',
    key,
    version: flag.version ?? 1,
    object: flag,
  }));

  return {
    id: PAYLOAD_ID,
    version: 1,
    // The selector MUST be empty — a non-empty selector would cause FDv2
    // synchronizers to try to resume from a bogus state.
    state: '',
    type: 'full',
    updates,
  };
}

/**
 * Creates a polling synchronizer that polls an FDv1 endpoint and produces
 * results in the FDv2 {@link Synchronizer} pull model.
 *
 * This is a standalone implementation (not a wrapper around the existing FDv1
 * `PollingProcessor`) because the FDv1 fallback is temporary and will be
 * removed in the next major version. A focused implementation is simpler than
 * an adapter layer.
 *
 * Polling starts lazily on the first call to `next()`. Each poll returns the
 * complete flag set as a `changeSet` result with `type: 'full'` and an empty
 * selector.
 *
 * @param requestor FDv1 requestor configured with the appropriate endpoint.
 * @param pollIntervalMs Interval between polls in milliseconds.
 * @param logger Optional logger.
 * @internal
 */
export function createFDv1PollingSynchronizer(
  requestor: Requestor,
  pollIntervalMs: number,
  logger?: LDLogger,
): Synchronizer {
  const resultQueue = createAsyncQueue<FDv2SourceResult>();
  let shutdownResolve: ((result: FDv2SourceResult) => void) | undefined;
  const shutdownPromise = new Promise<FDv2SourceResult>((resolve) => {
    shutdownResolve = resolve;
  });
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  let started = false;

  function scheduleNextPoll(startTime: number): void {
    if (!stopped) {
      const elapsed = Date.now() - startTime;
      const sleepFor = Math.min(Math.max(pollIntervalMs - elapsed, 0), pollIntervalMs);
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      timeoutHandle = setTimeout(doPoll, sleepFor);
    }
  }

  async function doPoll(): Promise<void> {
    if (stopped) {
      return;
    }

    logger?.debug('Polling FDv1 endpoint for feature flag updates');
    const startTime = Date.now();

    try {
      const body = await requestor.requestPayload();

      if (stopped) {
        return;
      }

      let flags: Flags;
      try {
        flags = JSON.parse(body);
      } catch {
        logger?.error('FDv1 polling received invalid JSON data');
        resultQueue.put({
          type: 'status',
          state: 'interrupted',
          errorInfo: errorInfoFromInvalidData('Malformed JSON data in FDv1 polling response'),
          fdv1Fallback: false,
        });
        scheduleNextPoll(startTime);
        return;
      }

      resultQueue.put(changeSet(flagsToPayload(flags), false));
    } catch (err) {
      if (stopped) {
        return;
      }

      const requestError = err as LDRequestError;
      if (requestError.status !== undefined) {
        if (!isHttpRecoverable(requestError.status)) {
          logger?.error(httpErrorMessage(err as HttpErrorResponse, 'FDv1 polling request'));
          stopped = true;
          shutdownResolve?.(terminalError(errorInfoFromHttpError(requestError.status), false));
          shutdownResolve = undefined;
          return;
        }
      }

      logger?.warn(
        httpErrorMessage(err as HttpErrorResponse, 'FDv1 polling request', 'will retry'),
      );
      resultQueue.put({
        type: 'status',
        state: 'interrupted',
        errorInfo: requestError.status
          ? errorInfoFromHttpError(requestError.status)
          : errorInfoFromNetworkError(requestError.message),
        fdv1Fallback: false,
      });
    }

    scheduleNextPoll(startTime);
  }

  return {
    next(): Promise<FDv2SourceResult> {
      if (!started) {
        started = true;
        doPoll();
      }
      return Promise.race([shutdownPromise, resultQueue.take()]);
    },

    close(): void {
      stopped = true;
      if (timeoutHandle !== undefined) {
        clearTimeout(timeoutHandle);
        timeoutHandle = undefined;
      }
      shutdownResolve?.(shutdown());
      shutdownResolve = undefined;
    },
  };
}
