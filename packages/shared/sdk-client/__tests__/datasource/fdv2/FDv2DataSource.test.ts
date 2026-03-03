import { DataSourceErrorKind, internal } from '@launchdarkly/js-sdk-common';

import { createFDv2DataSource } from '../../../src/datasource/fdv2/FDv2DataSource';
import {
  changeSet,
  FDv2SourceResult,
  goodbye,
  interrupted,
  shutdown,
  terminalError,
} from '../../../src/datasource/fdv2/FDv2SourceResult';
import { Initializer } from '../../../src/datasource/fdv2/Initializer';
import {
  createSynchronizerSlot,
  InitializerFactory,
  SynchronizerSlot,
} from '../../../src/datasource/fdv2/SourceManager';
import { Synchronizer } from '../../../src/datasource/fdv2/Synchronizer';

function makeLogger() {
  return {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
}

function makeStatusManager() {
  return {
    status: { state: 'CLOSED' as const, stateSince: 0 },
    requestStateUpdate: jest.fn(),
    reportError: jest.fn(),
  };
}

function makeErrorInfo() {
  return {
    kind: DataSourceErrorKind.NetworkError,
    message: 'test error',
    time: Date.now(),
  };
}

function makePayload(opts: { state?: string; type?: internal.PayloadType } = {}): internal.Payload {
  return {
    id: 'test-payload',
    version: 1,
    state: opts.state ?? 'test-selector',
    type: opts.type ?? 'full',
    updates: [],
  };
}

/**
 * Creates a mock initializer that resolves with the given result when run()
 * is called. Supports close() which resolves with shutdown.
 */
function makeMockInitializer(result: FDv2SourceResult): Initializer {
  let resolveRun: ((r: FDv2SourceResult) => void) | undefined;
  let closed = false;

  return {
    run() {
      if (closed) {
        return Promise.resolve(shutdown());
      }
      return new Promise<FDv2SourceResult>((resolve) => {
        resolveRun = resolve;
        // Auto-resolve if result is available
        resolve(result);
      });
    },
    close() {
      closed = true;
      resolveRun?.(shutdown());
    },
  };
}

/**
 * Creates a mock synchronizer that yields results from a sequence.
 * Each call to next() returns the next result in the sequence.
 * If the sequence is exhausted, next() blocks until close() is called.
 */
function makeMockSynchronizer(results: FDv2SourceResult[]): Synchronizer {
  let index = 0;
  let closed = false;
  let pendingResolve: ((r: FDv2SourceResult) => void) | undefined;

  return {
    next() {
      if (closed) {
        return Promise.resolve(shutdown());
      }
      if (index < results.length) {
        const result = results[index];
        index += 1;
        return Promise.resolve(result);
      }
      // Block until close
      return new Promise<FDv2SourceResult>((resolve) => {
        pendingResolve = resolve;
      });
    },
    close() {
      closed = true;
      pendingResolve?.(shutdown());
    },
  };
}

function makeInitFactory(init: Initializer): InitializerFactory {
  return () => init;
}

const noSelector = () => undefined;

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

// -- initialization phase --

it('resolves start() when initializer returns changeSet with selector', async () => {
  const dataCallback = jest.fn();
  const statusManager = makeStatusManager();
  const payload = makePayload({ state: 'my-selector' });

  const ds = createFDv2DataSource({
    initializerFactories: [makeInitFactory(makeMockInitializer(changeSet(payload, false)))],
    synchronizerSlots: [],
    dataCallback,
    statusManager,
    selectorGetter: noSelector,
  });

  await ds.start();

  expect(dataCallback).toHaveBeenCalledWith(payload);
  expect(statusManager.requestStateUpdate).toHaveBeenCalledWith('INITIALIZING');
  expect(statusManager.requestStateUpdate).toHaveBeenCalledWith('VALID');
  ds.close();
});

it('continues to next initializer when changeSet has no selector', async () => {
  const dataCallback = jest.fn();
  const statusManager = makeStatusManager();
  const payloadNoSelector = makePayload({ state: '' });
  const payloadWithSelector = makePayload({ state: 'good-selector' });

  const ds = createFDv2DataSource({
    initializerFactories: [
      makeInitFactory(makeMockInitializer(changeSet(payloadNoSelector, false))),
      makeInitFactory(makeMockInitializer(changeSet(payloadWithSelector, false))),
    ],
    synchronizerSlots: [],
    dataCallback,
    statusManager,
    selectorGetter: noSelector,
  });

  await ds.start();

  expect(dataCallback).toHaveBeenCalledTimes(2);
  ds.close();
});

it('resolves start() when all initializers exhausted but data was received', async () => {
  const dataCallback = jest.fn();
  const statusManager = makeStatusManager();
  const payloadNoSelector = makePayload({ state: '' });

  const ds = createFDv2DataSource({
    initializerFactories: [
      makeInitFactory(makeMockInitializer(changeSet(payloadNoSelector, false))),
    ],
    synchronizerSlots: [],
    dataCallback,
    statusManager,
    selectorGetter: noSelector,
  });

  await ds.start();

  expect(dataCallback).toHaveBeenCalledTimes(1);
  expect(statusManager.requestStateUpdate).toHaveBeenCalledWith('VALID');
  ds.close();
});

it('continues past initializer errors', async () => {
  const dataCallback = jest.fn();
  const statusManager = makeStatusManager();
  const logger = makeLogger();
  const payload = makePayload({ state: 'selector' });

  const ds = createFDv2DataSource({
    initializerFactories: [
      makeInitFactory(makeMockInitializer(interrupted(makeErrorInfo(), false))),
      makeInitFactory(makeMockInitializer(changeSet(payload, false))),
    ],
    synchronizerSlots: [],
    dataCallback,
    statusManager,
    selectorGetter: noSelector,
    logger,
  });

  await ds.start();

  expect(logger.warn).toHaveBeenCalled();
  expect(statusManager.reportError).toHaveBeenCalled();
  expect(dataCallback).toHaveBeenCalledWith(payload);
  ds.close();
});

it('continues past terminal errors in initializers', async () => {
  const dataCallback = jest.fn();
  const statusManager = makeStatusManager();
  const payload = makePayload({ state: 'selector' });

  const ds = createFDv2DataSource({
    initializerFactories: [
      makeInitFactory(makeMockInitializer(terminalError(makeErrorInfo(), false))),
      makeInitFactory(makeMockInitializer(changeSet(payload, false))),
    ],
    synchronizerSlots: [],
    dataCallback,
    statusManager,
    selectorGetter: noSelector,
  });

  await ds.start();
  expect(dataCallback).toHaveBeenCalledWith(payload);
  ds.close();
});

it('skips to synchronizers when no initializers are configured', async () => {
  const dataCallback = jest.fn();
  const statusManager = makeStatusManager();
  const payload = makePayload({ state: 'selector' });

  const sync = makeMockSynchronizer([changeSet(payload, false)]);
  const slots: SynchronizerSlot[] = [createSynchronizerSlot(() => sync)];

  const ds = createFDv2DataSource({
    initializerFactories: [],
    synchronizerSlots: slots,
    dataCallback,
    statusManager,
    selectorGetter: noSelector,
  });

  await ds.start();

  expect(dataCallback).toHaveBeenCalledWith(payload);
  ds.close();
});

// -- synchronization phase --

it('delivers changeSet from synchronizer to callback', async () => {
  const dataCallback = jest.fn();
  const statusManager = makeStatusManager();
  const payload = makePayload({ state: 'sync-selector' });

  const sync = makeMockSynchronizer([changeSet(payload, false)]);
  const slots: SynchronizerSlot[] = [createSynchronizerSlot(() => sync)];

  const ds = createFDv2DataSource({
    initializerFactories: [],
    synchronizerSlots: slots,
    dataCallback,
    statusManager,
    selectorGetter: noSelector,
  });

  await ds.start();

  expect(dataCallback).toHaveBeenCalledWith(payload);
  expect(statusManager.requestStateUpdate).toHaveBeenCalledWith('VALID');
  ds.close();
});

it('blocks synchronizer on terminal error and moves to next', async () => {
  const dataCallback = jest.fn();
  const statusManager = makeStatusManager();
  const logger = makeLogger();
  const payload = makePayload({ state: 'selector' });

  const sync1 = makeMockSynchronizer([terminalError(makeErrorInfo(), false)]);
  const sync2 = makeMockSynchronizer([changeSet(payload, false)]);

  const slots: SynchronizerSlot[] = [
    createSynchronizerSlot(() => sync1),
    createSynchronizerSlot(() => sync2),
  ];

  const ds = createFDv2DataSource({
    initializerFactories: [],
    synchronizerSlots: slots,
    dataCallback,
    statusManager,
    selectorGetter: noSelector,
    logger,
  });

  await ds.start();

  expect(logger.error).toHaveBeenCalled();
  expect(statusManager.reportError).toHaveBeenCalled();
  expect(dataCallback).toHaveBeenCalledWith(payload);
  ds.close();
});

it('continues on interrupted results from synchronizer', async () => {
  const dataCallback = jest.fn();
  const statusManager = makeStatusManager();
  const payload = makePayload({ state: 'selector' });

  const sync = makeMockSynchronizer([
    interrupted(makeErrorInfo(), false),
    changeSet(payload, false),
  ]);
  const slots: SynchronizerSlot[] = [createSynchronizerSlot(() => sync)];

  const ds = createFDv2DataSource({
    initializerFactories: [],
    synchronizerSlots: slots,
    dataCallback,
    statusManager,
    selectorGetter: noSelector,
  });

  await ds.start();

  expect(statusManager.reportError).toHaveBeenCalled();
  expect(dataCallback).toHaveBeenCalledWith(payload);
  ds.close();
});

it('continues on goodbye results from synchronizer', async () => {
  const dataCallback = jest.fn();
  const statusManager = makeStatusManager();
  const payload = makePayload({ state: 'selector' });

  const sync = makeMockSynchronizer([goodbye('reconnect', false), changeSet(payload, false)]);
  const slots: SynchronizerSlot[] = [createSynchronizerSlot(() => sync)];

  const ds = createFDv2DataSource({
    initializerFactories: [],
    synchronizerSlots: slots,
    dataCallback,
    statusManager,
    selectorGetter: noSelector,
  });

  await ds.start();

  expect(dataCallback).toHaveBeenCalledWith(payload);
  ds.close();
});

it('rejects start() when all synchronizers are exhausted without data', async () => {
  const dataCallback = jest.fn();
  const statusManager = makeStatusManager();

  const sync = makeMockSynchronizer([terminalError(makeErrorInfo(), false)]);
  const slots: SynchronizerSlot[] = [createSynchronizerSlot(() => sync)];

  const ds = createFDv2DataSource({
    initializerFactories: [],
    synchronizerSlots: slots,
    dataCallback,
    statusManager,
    selectorGetter: noSelector,
  });

  await expect(ds.start()).rejects.toThrow('All data sources exhausted');
  ds.close();
});

// -- fdv1 fallback --

it('triggers fdv1 fallback when synchronizer changeSet has fdv1Fallback flag', async () => {
  const dataCallback = jest.fn();
  const statusManager = makeStatusManager();

  const fdv2Payload = makePayload({ state: 'selector' });
  const fdv1Payload = makePayload({ state: 'fdv1-selector' });

  const fdv2Sync = makeMockSynchronizer([changeSet(fdv2Payload, true)]);
  const fdv1Sync = makeMockSynchronizer([changeSet(fdv1Payload, false)]);

  const slots: SynchronizerSlot[] = [
    createSynchronizerSlot(() => fdv2Sync),
    createSynchronizerSlot(() => fdv1Sync, { isFDv1Fallback: true }),
  ];

  const ds = createFDv2DataSource({
    initializerFactories: [],
    synchronizerSlots: slots,
    dataCallback,
    statusManager,
    selectorGetter: noSelector,
  });

  const startPromise = ds.start();

  // Allow orchestration loop to process fdv2 changeSet, trigger fallback,
  // and then process fdv1 changeSet
  await jest.advanceTimersByTimeAsync(0);
  await jest.advanceTimersByTimeAsync(0);

  await startPromise;

  // Both changeSets should be delivered
  expect(dataCallback).toHaveBeenCalledTimes(2);
  expect(dataCallback).toHaveBeenCalledWith(fdv2Payload);
  expect(dataCallback).toHaveBeenCalledWith(fdv1Payload);
  ds.close();
});

it('triggers fdv1 fallback on terminal error with fdv1Fallback flag', async () => {
  const dataCallback = jest.fn();
  const statusManager = makeStatusManager();
  const logger = makeLogger();

  const fdv1Payload = makePayload({ state: 'fdv1-selector' });

  const fdv2Sync = makeMockSynchronizer([terminalError(makeErrorInfo(), true)]);
  const fdv1Sync = makeMockSynchronizer([changeSet(fdv1Payload, false)]);

  const slots: SynchronizerSlot[] = [
    createSynchronizerSlot(() => fdv2Sync),
    createSynchronizerSlot(() => fdv1Sync, { isFDv1Fallback: true }),
  ];

  const ds = createFDv2DataSource({
    initializerFactories: [],
    synchronizerSlots: slots,
    dataCallback,
    statusManager,
    selectorGetter: noSelector,
    logger,
  });

  const startPromise = ds.start();

  // Allow orchestration loop to process terminal error, trigger fallback,
  // and then process fdv1 changeSet
  await jest.advanceTimersByTimeAsync(0);
  await jest.advanceTimersByTimeAsync(0);
  await jest.advanceTimersByTimeAsync(0);

  await startPromise;

  expect(logger.error).toHaveBeenCalled();
  expect(dataCallback).toHaveBeenCalledWith(fdv1Payload);
  ds.close();
});

// -- conditions --

it('falls back to next synchronizer when fallback condition fires', async () => {
  const dataCallback = jest.fn();
  const statusManager = makeStatusManager();
  const logger = makeLogger();
  const payload = makePayload({ state: 'selector' });

  // sync1 sends interrupted, then blocks (never sends another result)
  let sync1NextResolve: ((r: FDv2SourceResult) => void) | undefined;
  const sync1: Synchronizer = {
    next: jest
      .fn<Promise<FDv2SourceResult>, []>()
      .mockResolvedValueOnce(interrupted(makeErrorInfo(), false))
      .mockReturnValue(
        new Promise<FDv2SourceResult>((resolve) => {
          sync1NextResolve = resolve;
        }),
      ),
    close() {
      sync1NextResolve?.(shutdown());
    },
  };

  const sync2 = makeMockSynchronizer([changeSet(payload, false)]);

  const slots: SynchronizerSlot[] = [
    createSynchronizerSlot(() => sync1),
    createSynchronizerSlot(() => sync2),
  ];

  const ds = createFDv2DataSource({
    initializerFactories: [],
    synchronizerSlots: slots,
    dataCallback,
    statusManager,
    selectorGetter: noSelector,
    logger,
    fallbackTimeoutMs: 1000,
  });

  const startPromise = ds.start();

  // Allow the first sync's interrupted result to be processed
  await jest.advanceTimersByTimeAsync(0);

  // Now advance past the fallback timeout
  await jest.advanceTimersByTimeAsync(1000);

  await startPromise;

  expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Fallback condition fired'));
  expect(dataCallback).toHaveBeenCalledWith(payload);
  ds.close();
});

it('recovers to primary synchronizer when recovery condition fires', async () => {
  const dataCallback = jest.fn();
  const statusManager = makeStatusManager();
  const logger = makeLogger();
  const payload = makePayload({ state: 'selector' });

  // Scenario: sync1 (primary) gets interrupted, fallback fires after 500ms
  // moving to sync2 (secondary). Recovery fires after 1000ms, resetting
  // back to sync1 which now produces data.

  // sync1: first time sends interrupted then blocks. Second time sends data.
  let sync1CallCount = 0;
  const sync1Factory = () => {
    sync1CallCount += 1;
    if (sync1CallCount === 1) {
      // First invocation: interrupted then blocks
      let blockResolve: ((r: FDv2SourceResult) => void) | undefined;
      return {
        next: jest
          .fn<Promise<FDv2SourceResult>, []>()
          .mockResolvedValueOnce(interrupted(makeErrorInfo(), false))
          .mockReturnValue(
            new Promise<FDv2SourceResult>((resolve) => {
              blockResolve = resolve;
            }),
          ),
        close() {
          blockResolve?.(shutdown());
        },
      } as Synchronizer;
    }
    // Second invocation (after recovery): sends data
    return makeMockSynchronizer([changeSet(payload, false)]);
  };

  // sync2: blocks immediately (just waits)
  let sync2BlockResolve: ((r: FDv2SourceResult) => void) | undefined;
  const sync2Factory = () => ({
    next: jest.fn<Promise<FDv2SourceResult>, []>().mockReturnValue(
      new Promise<FDv2SourceResult>((resolve) => {
        sync2BlockResolve = resolve;
      }),
    ),
    close() {
      sync2BlockResolve?.(shutdown());
    },
  });

  const slots: SynchronizerSlot[] = [
    createSynchronizerSlot(sync1Factory),
    createSynchronizerSlot(sync2Factory),
  ];

  const ds = createFDv2DataSource({
    initializerFactories: [],
    synchronizerSlots: slots,
    dataCallback,
    statusManager,
    selectorGetter: noSelector,
    logger,
    fallbackTimeoutMs: 500,
    recoveryTimeoutMs: 1000,
  });

  const startPromise = ds.start();

  // Process sync1's interrupted result
  await jest.advanceTimersByTimeAsync(0);

  // Fallback fires at 500ms → moves to sync2
  await jest.advanceTimersByTimeAsync(500);
  // Let orchestration process the fallback
  await jest.advanceTimersByTimeAsync(0);
  await jest.advanceTimersByTimeAsync(0);
  await jest.advanceTimersByTimeAsync(0);
  await jest.advanceTimersByTimeAsync(0);
  await jest.advanceTimersByTimeAsync(0);

  // Recovery fires at 1000ms from when sync2 started → resets to primary
  await jest.advanceTimersByTimeAsync(1000);
  // Let orchestration process recovery and sync1's second invocation
  await jest.advanceTimersByTimeAsync(0);
  await jest.advanceTimersByTimeAsync(0);
  await jest.advanceTimersByTimeAsync(0);
  await jest.advanceTimersByTimeAsync(0);
  await jest.advanceTimersByTimeAsync(0);

  await startPromise;

  expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Recovery condition fired'));
  expect(dataCallback).toHaveBeenCalledWith(payload);
  ds.close();
});

// -- close --

it('close during initialization causes start to reject', async () => {
  const dataCallback = jest.fn();
  const statusManager = makeStatusManager();

  // Initializer that blocks forever until closed
  let resolveRun: ((r: FDv2SourceResult) => void) | undefined;
  const blockingInit: Initializer = {
    run: () =>
      new Promise<FDv2SourceResult>((resolve) => {
        resolveRun = resolve;
      }),
    close() {
      resolveRun?.(shutdown());
    },
  };

  const ds = createFDv2DataSource({
    initializerFactories: [makeInitFactory(blockingInit)],
    synchronizerSlots: [],
    dataCallback,
    statusManager,
    selectorGetter: noSelector,
  });

  // Capture the rejection so it doesn't become unhandled
  const startPromise = ds.start().catch((e) => e);

  // Let the orchestration start
  await jest.advanceTimersByTimeAsync(0);

  ds.close();

  // Allow the shutdown result to propagate through the orchestration loop
  await jest.advanceTimersByTimeAsync(0);
  await jest.advanceTimersByTimeAsync(0);

  const error = await startPromise;
  expect(error).toBeInstanceOf(Error);
  expect((error as Error).message).toContain('closed before initialization');
  expect(dataCallback).not.toHaveBeenCalled();
});

it('close during synchronization causes exit', async () => {
  const dataCallback = jest.fn();
  const statusManager = makeStatusManager();
  const payload = makePayload({ state: 'selector' });

  // Sync that produces one changeSet then blocks
  let pendingResolve: ((r: FDv2SourceResult) => void) | undefined;
  const sync: Synchronizer = {
    next: jest
      .fn<Promise<FDv2SourceResult>, []>()
      .mockResolvedValueOnce(changeSet(payload, false))
      .mockReturnValue(
        new Promise<FDv2SourceResult>((resolve) => {
          pendingResolve = resolve;
        }),
      ),
    close() {
      pendingResolve?.(shutdown());
    },
  };

  const slots: SynchronizerSlot[] = [createSynchronizerSlot(() => sync)];

  const ds = createFDv2DataSource({
    initializerFactories: [],
    synchronizerSlots: slots,
    dataCallback,
    statusManager,
    selectorGetter: noSelector,
  });

  const startPromise = ds.start();
  await startPromise;

  // Now the sync loop is running in the background, waiting on next()
  ds.close();

  // Give the shutdown result time to propagate
  await Promise.resolve();
  await Promise.resolve();

  expect(dataCallback).toHaveBeenCalledTimes(1);
});

// -- selectorGetter --

it('passes selectorGetter from config through to source factories', async () => {
  const dataCallback = jest.fn();
  const statusManager = makeStatusManager();
  const selectorGetter = jest.fn(() => 'test-selector');
  const payload = makePayload({ state: 'selector' });

  const syncFactory = jest.fn(() => makeMockSynchronizer([changeSet(payload, false)]));
  const slots: SynchronizerSlot[] = [createSynchronizerSlot(syncFactory)];

  const ds = createFDv2DataSource({
    initializerFactories: [],
    synchronizerSlots: slots,
    dataCallback,
    statusManager,
    selectorGetter,
  });

  await ds.start();

  expect(syncFactory).toHaveBeenCalledWith(selectorGetter);
  ds.close();
});

// -- empty configurations --

it('rejects start() with no initializers and no synchronizers', async () => {
  const dataCallback = jest.fn();
  const statusManager = makeStatusManager();

  const ds = createFDv2DataSource({
    initializerFactories: [],
    synchronizerSlots: [],
    dataCallback,
    statusManager,
    selectorGetter: noSelector,
  });

  await expect(ds.start()).rejects.toThrow('All data sources exhausted');
  ds.close();
});

it('resolves with initializer data even when no synchronizers exist', async () => {
  const dataCallback = jest.fn();
  const statusManager = makeStatusManager();
  const payload = makePayload({ state: 'selector' });

  const ds = createFDv2DataSource({
    initializerFactories: [makeInitFactory(makeMockInitializer(changeSet(payload, false)))],
    synchronizerSlots: [],
    dataCallback,
    statusManager,
    selectorGetter: noSelector,
  });

  await ds.start();

  expect(dataCallback).toHaveBeenCalledWith(payload);
  ds.close();
});
