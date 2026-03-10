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
  SynchronizerSlot,
} from '../../../src/datasource/fdv2/SourceManager';
import { Synchronizer } from '../../../src/datasource/fdv2/Synchronizer';
import {
  makeErrorInfo,
  makeInitFactory,
  makeLogger,
  makeMockInitializer,
  makeMockSynchronizer,
  makePayload,
  makeStatusManager,
  noSelector,
} from './orchestrationTestHelpers';

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

  await ds.start();

  // Wait for the fdv1 synchronizer to deliver its changeSet (second VALID).
  await statusManager.waitForState('VALID', 2);

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

  // Start resolves when the fdv1 synchronizer delivers its changeSet.
  await ds.start();

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
    fallbackTimeoutMs: 10,
  });

  // start() resolves when the fallback condition fires (after 10ms),
  // the orchestrator moves to sync2, and sync2 delivers the changeSet.
  await ds.start();

  expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Fallback condition fired'));
  expect(dataCallback).toHaveBeenCalledWith(payload);
  ds.close();
});

it('recovers to primary synchronizer when recovery condition fires', async () => {
  const dataCallback = jest.fn();
  const statusManager = makeStatusManager();
  const logger = makeLogger();
  const payload = makePayload({ state: 'selector' });

  // Scenario: sync1 (primary) gets interrupted, fallback fires after 10ms
  // moving to sync2 (secondary). Recovery fires after 20ms, resetting
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
    fallbackTimeoutMs: 10,
    recoveryTimeoutMs: 20,
  });

  // start() resolves after: sync1 interrupted → fallback (10ms) → sync2 blocks →
  // recovery (20ms) → sync1 second invocation delivers changeSet.
  await ds.start();

  expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Recovery condition fired'));
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

  const startPromise = ds.start().catch((e) => e);

  // close resolves the blocked init with shutdown, causing orchestration to exit.
  ds.close();

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

  await ds.start();

  // Now the sync loop is running in the background, waiting on next().
  // close() resolves the pending next() with shutdown.
  ds.close();

  // Only the first changeSet was delivered; shutdown does not produce data.
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

it('resolves start() immediately with VALID when no initializers and no synchronizers', async () => {
  const dataCallback = jest.fn();
  const statusManager = makeStatusManager();

  const ds = createFDv2DataSource({
    initializerFactories: [],
    synchronizerSlots: [],
    dataCallback,
    statusManager,
    selectorGetter: noSelector,
  });

  await ds.start();

  expect(statusManager.requestStateUpdate).toHaveBeenCalledWith('VALID');
  expect(dataCallback).not.toHaveBeenCalled();
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

// -- shutdown exits immediately --

it('shutdown result from synchronizer exits without moving to next', async () => {
  const dataCallback = jest.fn();
  const statusManager = makeStatusManager();
  const payload = makePayload({ state: 'selector' });

  const secondSyncFactory = jest.fn(() => makeMockSynchronizer([changeSet(payload, false)]));
  const slots: SynchronizerSlot[] = [
    createSynchronizerSlot(() => makeMockSynchronizer([changeSet(payload, false), shutdown()])),
    createSynchronizerSlot(secondSyncFactory),
  ];

  const ds = createFDv2DataSource({
    initializerFactories: [],
    synchronizerSlots: slots,
    dataCallback,
    statusManager,
    selectorGetter: noSelector,
  });

  await ds.start();

  // Wait for the shutdown to be processed — the second synchronizer should not be created.
  await statusManager.waitForState('VALID', 1);
  expect(dataCallback).toHaveBeenCalledTimes(1);
  expect(secondSyncFactory).not.toHaveBeenCalled();
  ds.close();
});

// -- multiple changeSets --

it('delivers multiple changeSets from synchronizer in order', async () => {
  const dataCallback = jest.fn();
  const statusManager = makeStatusManager();
  const payload1 = makePayload({ state: 'selector-1' });
  const payload2 = makePayload({ state: 'selector-2' });
  const payload3 = makePayload({ state: 'selector-3' });

  const sync = makeMockSynchronizer([
    changeSet(payload1, false),
    changeSet(payload2, false),
    changeSet(payload3, false),
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

  // Wait for all three changeSets to be processed.
  await statusManager.waitForState('VALID', 3);

  expect(dataCallback).toHaveBeenCalledTimes(3);
  expect(dataCallback).toHaveBeenNthCalledWith(1, payload1);
  expect(dataCallback).toHaveBeenNthCalledWith(2, payload2);
  expect(dataCallback).toHaveBeenNthCalledWith(3, payload3);
  ds.close();
});

// -- initializer short-circuit --

it('first initializer with selector prevents second initializer from running', async () => {
  const dataCallback = jest.fn();
  const statusManager = makeStatusManager();
  const payload = makePayload({ state: 'good-selector' });

  const secondInitFactory = jest.fn(() =>
    makeMockInitializer(changeSet(makePayload({ state: 'second' }), false)),
  );

  const ds = createFDv2DataSource({
    initializerFactories: [
      makeInitFactory(makeMockInitializer(changeSet(payload, false))),
      secondInitFactory,
    ],
    synchronizerSlots: [],
    dataCallback,
    statusManager,
    selectorGetter: noSelector,
  });

  await ds.start();

  expect(dataCallback).toHaveBeenCalledTimes(1);
  expect(dataCallback).toHaveBeenCalledWith(payload);
  expect(secondInitFactory).not.toHaveBeenCalled();
  ds.close();
});

// -- close idempotency --

it('multiple close calls do not throw', async () => {
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

  ds.close();
  ds.close();
  ds.close();
  // Should not throw
});

// -- close during condition waiting --

it('close during condition waiting exits cleanly', async () => {
  const dataCallback = jest.fn();
  const statusManager = makeStatusManager();

  // Sync sends changeSet then interrupted, then blocks — condition timer starts
  let pendingResolve: ((r: FDv2SourceResult) => void) | undefined;
  const sync: Synchronizer = {
    next: jest
      .fn<Promise<FDv2SourceResult>, []>()
      .mockResolvedValueOnce(changeSet(makePayload({ state: 'selector' }), false))
      .mockResolvedValueOnce(interrupted(makeErrorInfo(), false))
      .mockReturnValue(
        new Promise<FDv2SourceResult>((resolve) => {
          pendingResolve = resolve;
        }),
      ),
    close() {
      pendingResolve?.(shutdown());
    },
  };

  const slots: SynchronizerSlot[] = [
    createSynchronizerSlot(() => sync),
    createSynchronizerSlot(() => makeMockSynchronizer([])),
  ];

  const ds = createFDv2DataSource({
    initializerFactories: [],
    synchronizerSlots: slots,
    dataCallback,
    statusManager,
    selectorGetter: noSelector,
    fallbackTimeoutMs: 60000,
  });

  await ds.start();

  // Sync loop is running, condition timer is active — close should not hang.
  ds.close();
});

// -- fdv1 fallback additional coverage --

it('fdv1 fallback not triggered when fdv1Fallback flag is absent', async () => {
  const dataCallback = jest.fn();
  const statusManager = makeStatusManager();
  const payload = makePayload({ state: 'selector' });

  const fdv1Factory = jest.fn(() => makeMockSynchronizer([]));

  const slots: SynchronizerSlot[] = [
    createSynchronizerSlot(() => makeMockSynchronizer([changeSet(payload, false)])),
    createSynchronizerSlot(fdv1Factory, { isFDv1Fallback: true }),
  ];

  const ds = createFDv2DataSource({
    initializerFactories: [],
    synchronizerSlots: slots,
    dataCallback,
    statusManager,
    selectorGetter: noSelector,
  });

  await ds.start();

  expect(dataCallback).toHaveBeenCalledWith(payload);
  expect(fdv1Factory).not.toHaveBeenCalled();
  ds.close();
});

it('fdv1 fallback blocks other synchronizers', async () => {
  const dataCallback = jest.fn();
  const statusManager = makeStatusManager();
  const fdv2Payload = makePayload({ state: 'selector' });
  const fdv1Payload = makePayload({ state: 'fdv1-selector' });

  const secondSyncFactory = jest.fn(() => makeMockSynchronizer([]));

  const slots: SynchronizerSlot[] = [
    createSynchronizerSlot(() => makeMockSynchronizer([changeSet(fdv2Payload, true)])),
    createSynchronizerSlot(secondSyncFactory),
    createSynchronizerSlot(() => makeMockSynchronizer([changeSet(fdv1Payload, false)]), {
      isFDv1Fallback: true,
    }),
  ];

  const ds = createFDv2DataSource({
    initializerFactories: [],
    synchronizerSlots: slots,
    dataCallback,
    statusManager,
    selectorGetter: noSelector,
  });

  await ds.start();

  // Wait for fdv1 synchronizer to deliver its changeSet (second VALID).
  await statusManager.waitForState('VALID', 2);

  // FDv1 fallback should block non-FDv1 synchronizers — second sync should not be called
  expect(secondSyncFactory).not.toHaveBeenCalled();
  expect(dataCallback).toHaveBeenCalledWith(fdv1Payload);
  ds.close();
});

it('fdv1 fallback ignored when no FDv1 synchronizer is configured', async () => {
  const dataCallback = jest.fn();
  const statusManager = makeStatusManager();
  const payload = makePayload({ state: 'selector' });

  // Synchronizer sends changeSet with fdv1Fallback flag but no FDv1 slot exists
  const sync = makeMockSynchronizer([changeSet(payload, true)]);
  const slots: SynchronizerSlot[] = [createSynchronizerSlot(() => sync)];

  const ds = createFDv2DataSource({
    initializerFactories: [],
    synchronizerSlots: slots,
    dataCallback,
    statusManager,
    selectorGetter: noSelector,
  });

  await ds.start();

  // Should process the changeSet normally without error
  expect(dataCallback).toHaveBeenCalledWith(payload);
  ds.close();
});

it('fdv1 fallback triggered on interrupted result with fdv1Fallback flag', async () => {
  const dataCallback = jest.fn();
  const statusManager = makeStatusManager();
  const fdv1Payload = makePayload({ state: 'fdv1-selector' });

  const fdv2Sync = makeMockSynchronizer([interrupted(makeErrorInfo(), true)]);
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

  // Start resolves when the fdv1 synchronizer delivers its changeSet.
  await ds.start();

  expect(dataCallback).toHaveBeenCalledWith(fdv1Payload);
  ds.close();
});
