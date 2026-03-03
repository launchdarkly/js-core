import { DataSourceErrorKind, internal } from '@launchdarkly/js-sdk-common';

import { FDv2SourceResult, shutdown } from '../../../src/datasource/fdv2/FDv2SourceResult';
import { Initializer } from '../../../src/datasource/fdv2/Initializer';
import {
  InitializerFactory,
  SynchronizerFactory,
} from '../../../src/datasource/fdv2/SourceManager';
import { Synchronizer } from '../../../src/datasource/fdv2/Synchronizer';

export function makeLogger() {
  return {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
}

export interface MockStatusManager {
  status: { state: 'CLOSED'; stateSince: number };
  requestStateUpdate: jest.Mock;
  reportError: jest.Mock;
  /**
   * Returns a promise that resolves when `requestStateUpdate` has been called
   * with the given state at least `count` times. If the count is already met,
   * the returned promise is already resolved.
   */
  waitForState(state: string, count?: number): Promise<void>;
}

export function makeStatusManager(): MockStatusManager {
  const stateCounts: Record<string, number> = {};
  const waiters: Array<{ state: string; count: number; resolve: () => void }> = [];

  function checkWaiters() {
    for (let i = waiters.length - 1; i >= 0; i -= 1) {
      const w = waiters[i];
      if ((stateCounts[w.state] ?? 0) >= w.count) {
        w.resolve();
        waiters.splice(i, 1);
      }
    }
  }

  const requestStateUpdate = jest.fn((state: string) => {
    stateCounts[state] = (stateCounts[state] ?? 0) + 1;
    checkWaiters();
  });

  return {
    status: { state: 'CLOSED' as const, stateSince: 0 },
    requestStateUpdate,
    reportError: jest.fn(),
    waitForState(state: string, count: number = 1): Promise<void> {
      if ((stateCounts[state] ?? 0) >= count) {
        return Promise.resolve();
      }
      return new Promise<void>((resolve) => {
        waiters.push({ state, count, resolve });
      });
    },
  };
}

export function makeErrorInfo() {
  return {
    kind: DataSourceErrorKind.NetworkError,
    message: 'test error',
    time: Date.now(),
  };
}

export function makePayload(
  opts: { state?: string; type?: internal.PayloadType } = {},
): internal.Payload {
  return {
    id: 'test-payload',
    version: 1,
    state: opts.state ?? 'test-selector',
    type: opts.type ?? 'full',
    updates: [],
  };
}

export const noSelector = () => undefined;

/**
 * Creates a mock initializer that resolves with the given result when run()
 * is called. If no result is given, defaults to a shutdown result.
 * Supports close() which resolves a pending run() with shutdown.
 */
export function makeMockInitializer(result?: FDv2SourceResult): Initializer & { closed: boolean } {
  let resolveRun: ((r: FDv2SourceResult) => void) | undefined;
  const defaultResult = result ?? shutdown();

  const init: Initializer & { closed: boolean } = {
    closed: false,
    run() {
      if (init.closed) {
        return Promise.resolve(shutdown());
      }
      return new Promise<FDv2SourceResult>((resolve) => {
        resolveRun = resolve;
        resolve(defaultResult);
      });
    },
    close() {
      init.closed = true;
      resolveRun?.(shutdown());
    },
  };

  return init;
}

/**
 * Creates a mock synchronizer that yields results from a sequence.
 * Each call to next() returns the next result in the sequence.
 * If the sequence is exhausted, next() blocks until close() is called.
 * If no results are given, defaults to empty (blocks immediately).
 */
export function makeMockSynchronizer(
  results: FDv2SourceResult[] = [],
): Synchronizer & { closed: boolean } {
  let index = 0;
  let pendingResolve: ((r: FDv2SourceResult) => void) | undefined;

  const sync: Synchronizer & { closed: boolean } = {
    closed: false,
    next() {
      if (sync.closed) {
        return Promise.resolve(shutdown());
      }
      if (index < results.length) {
        const result = results[index];
        index += 1;
        return Promise.resolve(result);
      }
      return new Promise<FDv2SourceResult>((resolve) => {
        pendingResolve = resolve;
      });
    },
    close() {
      sync.closed = true;
      pendingResolve?.(shutdown());
    },
  };

  return sync;
}

export function makeInitFactory(init: Initializer): InitializerFactory {
  return jest.fn(() => init);
}

export function makeSyncFactory(sync: Synchronizer): SynchronizerFactory {
  return jest.fn(() => sync);
}
