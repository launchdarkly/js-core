import { internal } from '@launchdarkly/js-sdk-common';

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
  makeCacheInitFactory,
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
    initializerFactories: [makeInitFactory(makeMockInitializer(changeSet(payload, { fdv1Fallback: false })))],
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
      makeInitFactory(makeMockInitializer(changeSet(payloadNoSelector, { fdv1Fallback: false }))),
      makeInitFactory(makeMockInitializer(changeSet(payloadWithSelector, { fdv1Fallback: false }))),
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
      makeInitFactory(makeMockInitializer(changeSet(payloadNoSelector, { fdv1Fallback: false }))),
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

it('skips transfer-none initializer results without calling dataCallback', async () => {
  const dataCallback = jest.fn();
  const statusManager = makeStatusManager();
  const nonePayload = makePayload({ type: 'none' });
  const fullPayload = makePayload({ state: 'selector' });

  const ds = createFDv2DataSource({
    initializerFactories: [
      makeInitFactory(makeMockInitializer(changeSet(nonePayload, { fdv1Fallback: false }))),
      makeInitFactory(makeMockInitializer(changeSet(fullPayload, { fdv1Fallback: false }))),
    ],
    synchronizerSlots: [],
    dataCallback,
    statusManager,
    selectorGetter: noSelector,
  });

  await ds.start();

  expect(dataCallback).toHaveBeenCalledTimes(1);
  expect(dataCallback).toHaveBeenCalledWith(fullPayload);
  ds.close();
});

it('does not mark data received for transfer-none initializer results', async () => {
  const dataCallback = jest.fn();
  const statusManager = makeStatusManager();
  const nonePayload = makePayload({ type: 'none' });

  const ds = createFDv2DataSource({
    initializerFactories: [makeInitFactory(makeMockInitializer(changeSet(nonePayload, { fdv1Fallback: false })))],
    synchronizerSlots: [],
    dataCallback,
    statusManager,
    selectorGetter: noSelector,
  });

  await expect(ds.start()).rejects.toThrow('All data sources exhausted');
  expect(dataCallback).not.toHaveBeenCalled();
  ds.close();
});

it('resolves start() when only initializer is a cache initializer that returns transfer-none', async () => {
  const dataCallback = jest.fn();
  const statusManager = makeStatusManager();
  const nonePayload = makePayload({ type: 'none' });

  const ds = createFDv2DataSource({
    initializerFactories: [
      makeCacheInitFactory(makeMockInitializer(changeSet(nonePayload, { fdv1Fallback: false }))),
    ],
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

it('does not overwrite an error status when a later initializer fails after data was received', async () => {
  // Scenario: initializer 1 delivers a payload without a selector (data
  // received, status VALID). Initializer 2 errors, which reports an error
  // status. When the chain exhausts with dataReceived=true, the orchestrator
  // must NOT re-assert VALID, because doing so would silently overwrite the
  // error status from the failed initializer.
  const dataCallback = jest.fn();
  const statusManager = makeStatusManager();
  const logger = makeLogger();
  const payloadNoSelector = makePayload({ state: '' });

  const ds = createFDv2DataSource({
    initializerFactories: [
      makeInitFactory(makeMockInitializer(changeSet(payloadNoSelector, { fdv1Fallback: false }))),
      makeInitFactory(makeMockInitializer(interrupted(makeErrorInfo(), { fdv1Fallback: false }))),
    ],
    synchronizerSlots: [],
    dataCallback,
    statusManager,
    selectorGetter: noSelector,
    logger,
  });

  await ds.start();

  expect(dataCallback).toHaveBeenCalledWith(payloadNoSelector);
  expect(statusManager.reportError).toHaveBeenCalled();
  // Exactly one VALID request: from applyChangeSet on the first initializer.
  // No second VALID from the exhaustion branch.
  const validCalls = statusManager.requestStateUpdate.mock.calls.filter(
    (args) => args[0] === 'VALID',
  );
  expect(validCalls).toHaveLength(1);
  ds.close();
});

it('rejects start() when close() is called before cache-only initialization runs', async () => {
  // Race: close() happens before the runInitializers microtask starts.
  // The cache-only success path must not fire a spurious VALID or resolve
  // the start() promise; it must reject with "closed before initialization".
  const dataCallback = jest.fn();
  const statusManager = makeStatusManager();
  const nonePayload = makePayload({ type: 'none' });

  const ds = createFDv2DataSource({
    initializerFactories: [
      makeCacheInitFactory(makeMockInitializer(changeSet(nonePayload, { fdv1Fallback: false }))),
    ],
    synchronizerSlots: [],
    dataCallback,
    statusManager,
    selectorGetter: noSelector,
  });

  const startPromise = ds.start().catch((e) => e);
  ds.close();
  const error = await startPromise;

  expect(error).toBeInstanceOf(Error);
  expect((error as Error).message).toContain('closed before initialization');
  expect(statusManager.requestStateUpdate).not.toHaveBeenCalledWith('VALID');
});

it('does not overwrite error status when a cache-only initializer reports interrupted', async () => {
  // Latent guard: even though the default CacheInitializer never emits
  // interrupted/terminal_error, a custom cache-marked factory could.
  // The cache-only exhaustion branch must not overwrite the reported
  // error status with VALID.
  const dataCallback = jest.fn();
  const statusManager = makeStatusManager();
  const logger = makeLogger();

  const ds = createFDv2DataSource({
    initializerFactories: [
      makeCacheInitFactory(makeMockInitializer(interrupted(makeErrorInfo(), { fdv1Fallback: false }))),
    ],
    synchronizerSlots: [],
    dataCallback,
    statusManager,
    selectorGetter: noSelector,
    logger,
  });

  // Initialization still completes (cache-only mode is always ready) but
  // without overriding the reported error status.
  await ds.start();

  expect(statusManager.reportError).toHaveBeenCalled();
  expect(statusManager.requestStateUpdate).not.toHaveBeenCalledWith('VALID');
  ds.close();
});

it('rejects when a cache initializer is followed by a non-cache initializer and neither delivers data', async () => {
  // Cache initializer misses (transfer-none) and a non-cache initializer
  // also returns transfer-none. Because the chain includes a non-cache
  // initializer, cacheOnlyDataSystem is false and the exhaustion branch
  // must NOT complete initialization successfully.
  const dataCallback = jest.fn();
  const statusManager = makeStatusManager();
  const nonePayload = makePayload({ type: 'none' });

  const ds = createFDv2DataSource({
    initializerFactories: [
      makeCacheInitFactory(makeMockInitializer(changeSet(nonePayload, { fdv1Fallback: false }))),
      makeInitFactory(makeMockInitializer(changeSet(nonePayload, { fdv1Fallback: false }))),
    ],
    synchronizerSlots: [],
    dataCallback,
    statusManager,
    selectorGetter: noSelector,
  });

  await expect(ds.start()).rejects.toThrow('All data sources exhausted');
  expect(dataCallback).not.toHaveBeenCalled();
  ds.close();
});

it('rejects when a cache initializer returns transfer-none but synchronizers exist', async () => {
  const dataCallback = jest.fn();
  const statusManager = makeStatusManager();
  const nonePayload = makePayload({ type: 'none' });

  // A synchronizer that produces a terminal error immediately, so no data is
  // delivered and the orchestrator exhausts all sources and rejects.
  const sync = makeMockSynchronizer([terminalError(makeErrorInfo(), { fdv1Fallback: false })]);
  const slots: SynchronizerSlot[] = [createSynchronizerSlot({ create: () => sync })];

  const ds = createFDv2DataSource({
    initializerFactories: [
      makeCacheInitFactory(makeMockInitializer(changeSet(nonePayload, { fdv1Fallback: false }))),
    ],
    synchronizerSlots: slots,
    dataCallback,
    statusManager,
    selectorGetter: noSelector,
  });

  await expect(ds.start()).rejects.toThrow('All data sources exhausted');
  ds.close();
});

it('continues past initializer errors', async () => {
  const dataCallback = jest.fn();
  const statusManager = makeStatusManager();
  const logger = makeLogger();
  const payload = makePayload({ state: 'selector' });

  const ds = createFDv2DataSource({
    initializerFactories: [
      makeInitFactory(makeMockInitializer(interrupted(makeErrorInfo(), { fdv1Fallback: false }))),
      makeInitFactory(makeMockInitializer(changeSet(payload, { fdv1Fallback: false }))),
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
      makeInitFactory(makeMockInitializer(terminalError(makeErrorInfo(), { fdv1Fallback: false }))),
      makeInitFactory(makeMockInitializer(changeSet(payload, { fdv1Fallback: false }))),
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

  const sync = makeMockSynchronizer([changeSet(payload, { fdv1Fallback: false })]);
  const slots: SynchronizerSlot[] = [createSynchronizerSlot({ create: () => sync })];

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

  const sync = makeMockSynchronizer([changeSet(payload, { fdv1Fallback: false })]);
  const slots: SynchronizerSlot[] = [createSynchronizerSlot({ create: () => sync })];

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

  const sync1 = makeMockSynchronizer([terminalError(makeErrorInfo(), { fdv1Fallback: false })]);
  const sync2 = makeMockSynchronizer([changeSet(payload, { fdv1Fallback: false })]);

  const slots: SynchronizerSlot[] = [
    createSynchronizerSlot({ create: () => sync1 }),
    createSynchronizerSlot({ create: () => sync2 }),
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
    interrupted(makeErrorInfo(), { fdv1Fallback: false }),
    changeSet(payload, { fdv1Fallback: false }),
  ]);
  const slots: SynchronizerSlot[] = [createSynchronizerSlot({ create: () => sync })];

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

  const sync = makeMockSynchronizer([goodbye('reconnect', { fdv1Fallback: false }), changeSet(payload, { fdv1Fallback: false })]);
  const slots: SynchronizerSlot[] = [createSynchronizerSlot({ create: () => sync })];

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

  const sync = makeMockSynchronizer([terminalError(makeErrorInfo(), { fdv1Fallback: false })]);
  const slots: SynchronizerSlot[] = [createSynchronizerSlot({ create: () => sync })];

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

  const fdv2Sync = makeMockSynchronizer([changeSet(fdv2Payload, { fdv1Fallback: true })]);
  const fdv1Sync = makeMockSynchronizer([changeSet(fdv1Payload, { fdv1Fallback: false })]);

  const slots: SynchronizerSlot[] = [
    createSynchronizerSlot({ create: () => fdv2Sync }),
    createSynchronizerSlot({ create: () => fdv1Sync }, { isFDv1Fallback: true }),
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

  const fdv2Sync = makeMockSynchronizer([terminalError(makeErrorInfo(), { fdv1Fallback: true })]);
  const fdv1Sync = makeMockSynchronizer([changeSet(fdv1Payload, { fdv1Fallback: false })]);

  const slots: SynchronizerSlot[] = [
    createSynchronizerSlot({ create: () => fdv2Sync }),
    createSynchronizerSlot({ create: () => fdv1Sync }, { isFDv1Fallback: true }),
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
      .mockResolvedValueOnce(interrupted(makeErrorInfo(), { fdv1Fallback: false }))
      .mockReturnValue(
        new Promise<FDv2SourceResult>((resolve) => {
          sync1NextResolve = resolve;
        }),
      ),
    close() {
      sync1NextResolve?.(shutdown());
    },
  };

  const sync2 = makeMockSynchronizer([changeSet(payload, { fdv1Fallback: false })]);

  const slots: SynchronizerSlot[] = [
    createSynchronizerSlot({ create: () => sync1 }),
    createSynchronizerSlot({ create: () => sync2 }),
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
          .mockResolvedValueOnce(interrupted(makeErrorInfo(), { fdv1Fallback: false }))
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
    return makeMockSynchronizer([changeSet(payload, { fdv1Fallback: false })]);
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
    createSynchronizerSlot({ create: sync1Factory }),
    createSynchronizerSlot({ create: sync2Factory }),
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

  // start() resolves once sync1 interrupts, fallback (10ms) moves to sync2,
  // recovery (20ms) moves back, and sync1's second invocation delivers the changeSet.
  await ds.start();

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
      .mockResolvedValueOnce(changeSet(payload, { fdv1Fallback: false }))
      .mockReturnValue(
        new Promise<FDv2SourceResult>((resolve) => {
          pendingResolve = resolve;
        }),
      ),
    close() {
      pendingResolve?.(shutdown());
    },
  };

  const slots: SynchronizerSlot[] = [createSynchronizerSlot({ create: () => sync })];

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

  const syncFactory = jest.fn(() => makeMockSynchronizer([changeSet(payload, { fdv1Fallback: false })]));
  const slots: SynchronizerSlot[] = [createSynchronizerSlot({ create: syncFactory })];

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
    initializerFactories: [makeInitFactory(makeMockInitializer(changeSet(payload, { fdv1Fallback: false })))],
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

  const secondSyncFactory = jest.fn(() => makeMockSynchronizer([changeSet(payload, { fdv1Fallback: false })]));
  const slots: SynchronizerSlot[] = [
    createSynchronizerSlot({
      create: () => makeMockSynchronizer([changeSet(payload, { fdv1Fallback: false }), shutdown()]),
    }),
    createSynchronizerSlot({ create: secondSyncFactory }),
  ];

  const ds = createFDv2DataSource({
    initializerFactories: [],
    synchronizerSlots: slots,
    dataCallback,
    statusManager,
    selectorGetter: noSelector,
  });

  await ds.start();

  // Wait for the shutdown to be processed before asserting the second synchronizer was never created.
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
    changeSet(payload1, { fdv1Fallback: false }),
    changeSet(payload2, { fdv1Fallback: false }),
    changeSet(payload3, { fdv1Fallback: false }),
  ]);
  const slots: SynchronizerSlot[] = [createSynchronizerSlot({ create: () => sync })];

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

  const secondInitCreate = jest.fn(() =>
    makeMockInitializer(changeSet(makePayload({ state: 'second' }), { fdv1Fallback: false })),
  );

  const ds = createFDv2DataSource({
    initializerFactories: [
      makeInitFactory(makeMockInitializer(changeSet(payload, { fdv1Fallback: false }))),
      { create: secondInitCreate },
    ],
    synchronizerSlots: [],
    dataCallback,
    statusManager,
    selectorGetter: noSelector,
  });

  await ds.start();

  expect(dataCallback).toHaveBeenCalledTimes(1);
  expect(dataCallback).toHaveBeenCalledWith(payload);
  expect(secondInitCreate).not.toHaveBeenCalled();
  ds.close();
});

// -- close idempotency --

it('multiple close calls do not throw', async () => {
  const dataCallback = jest.fn();
  const statusManager = makeStatusManager();
  const payload = makePayload({ state: 'selector' });

  const ds = createFDv2DataSource({
    initializerFactories: [makeInitFactory(makeMockInitializer(changeSet(payload, { fdv1Fallback: false })))],
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

  // Sync sends changeSet then interrupted, then blocks; the interrupted result starts the condition timer
  let pendingResolve: ((r: FDv2SourceResult) => void) | undefined;
  const sync: Synchronizer = {
    next: jest
      .fn<Promise<FDv2SourceResult>, []>()
      .mockResolvedValueOnce(changeSet(makePayload({ state: 'selector' }), { fdv1Fallback: false }))
      .mockResolvedValueOnce(interrupted(makeErrorInfo(), { fdv1Fallback: false }))
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
    createSynchronizerSlot({ create: () => sync }),
    createSynchronizerSlot({ create: () => makeMockSynchronizer([]) }),
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

  // Sync loop is running and the condition timer is active; close should not hang.
  ds.close();
});

// -- fdv1 fallback additional coverage --

it('fdv1 fallback not triggered when fdv1Fallback flag is absent', async () => {
  const dataCallback = jest.fn();
  const statusManager = makeStatusManager();
  const payload = makePayload({ state: 'selector' });

  const fdv1Factory = jest.fn(() => makeMockSynchronizer([]));

  const slots: SynchronizerSlot[] = [
    createSynchronizerSlot({ create: () => makeMockSynchronizer([changeSet(payload, { fdv1Fallback: false })]) }),
    createSynchronizerSlot({ create: fdv1Factory }, { isFDv1Fallback: true }),
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
    createSynchronizerSlot({
      create: () => makeMockSynchronizer([changeSet(fdv2Payload, { fdv1Fallback: true })]),
    }),
    createSynchronizerSlot({ create: secondSyncFactory }),
    createSynchronizerSlot(
      { create: () => makeMockSynchronizer([changeSet(fdv1Payload, { fdv1Fallback: false })]) },
      { isFDv1Fallback: true },
    ),
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

  // FDv1 fallback blocks non-FDv1 synchronizers: second sync should not be called
  expect(secondSyncFactory).not.toHaveBeenCalled();
  expect(dataCallback).toHaveBeenCalledWith(fdv1Payload);
  ds.close();
});

it('fdv1 fallback ignored when no FDv1 synchronizer is configured', async () => {
  const dataCallback = jest.fn();
  const statusManager = makeStatusManager();
  const payload = makePayload({ state: 'selector' });

  // Synchronizer sends changeSet with fdv1Fallback flag but no FDv1 slot exists
  const sync = makeMockSynchronizer([changeSet(payload, { fdv1Fallback: true })]);
  const slots: SynchronizerSlot[] = [createSynchronizerSlot({ create: () => sync })];

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

  const fdv2Sync = makeMockSynchronizer([interrupted(makeErrorInfo(), { fdv1Fallback: true })]);
  const fdv1Sync = makeMockSynchronizer([changeSet(fdv1Payload, { fdv1Fallback: false })]);

  const slots: SynchronizerSlot[] = [
    createSynchronizerSlot({ create: () => fdv2Sync }),
    createSynchronizerSlot({ create: () => fdv1Sync }, { isFDv1Fallback: true }),
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

it('stops initializer chain when a status result triggers fdv1 fallback', async () => {
  const dataCallback = jest.fn();
  const statusManager = makeStatusManager();
  const fdv1Payload = makePayload({ state: 'fdv1-selector' });

  const secondInit = makeMockInitializer(
    changeSet(makePayload({ state: 'second-selector' }), { fdv1Fallback: false }),
  );
  const secondInitRunSpy = jest.spyOn(secondInit, 'run');

  const fdv1Sync = makeMockSynchronizer([changeSet(fdv1Payload, { fdv1Fallback: false })]);

  const slots: SynchronizerSlot[] = [
    createSynchronizerSlot({ create: () => fdv1Sync }, { isFDv1Fallback: true }),
  ];

  const ds = createFDv2DataSource({
    initializerFactories: [
      makeInitFactory(makeMockInitializer(terminalError(makeErrorInfo(), { fdv1Fallback: true }))),
      makeInitFactory(secondInit),
    ],
    synchronizerSlots: slots,
    dataCallback,
    statusManager,
    selectorGetter: noSelector,
  });

  // Start resolves when the fdv1 synchronizer delivers its changeSet.
  await ds.start();

  expect(secondInitRunSpy).not.toHaveBeenCalled();
  expect(dataCallback).toHaveBeenCalledWith(fdv1Payload);
  ds.close();
});

it('stops initializer chain when a transfer-none changeSet triggers fdv1 fallback', async () => {
  const dataCallback = jest.fn();
  const statusManager = makeStatusManager();
  // Shape produced by PollingBase on an HTTP 304: no payload content and no
  // selector, but the response headers still carried the fallback directive.
  const nonePayload = makePayload({ type: 'none', state: '' });
  const fdv1Payload = makePayload({ state: 'fdv1-selector' });

  const secondInit = makeMockInitializer(
    changeSet(makePayload({ state: 'second-selector' }), { fdv1Fallback: false }),
  );
  const secondInitRunSpy = jest.spyOn(secondInit, 'run');

  const fdv1Sync = makeMockSynchronizer([changeSet(fdv1Payload, { fdv1Fallback: false })]);

  const slots: SynchronizerSlot[] = [
    createSynchronizerSlot({ create: () => fdv1Sync }, { isFDv1Fallback: true }),
  ];

  const ds = createFDv2DataSource({
    initializerFactories: [
      makeInitFactory(makeMockInitializer(changeSet(nonePayload, { fdv1Fallback: true }))),
      makeInitFactory(secondInit),
    ],
    synchronizerSlots: slots,
    dataCallback,
    statusManager,
    selectorGetter: noSelector,
  });

  // Start resolves when the fdv1 synchronizer delivers its changeSet.
  await ds.start();

  expect(secondInitRunSpy).not.toHaveBeenCalled();
  expect(dataCallback).not.toHaveBeenCalledWith(nonePayload);
  expect(dataCallback).toHaveBeenCalledWith(fdv1Payload);
  ds.close();
});

// -- FDv1 fallback re-trigger guard (regression: SDK-2617) --

it('does not re-trigger fallback when the fdv1 synchronizer itself yields a fallback-flagged result', async () => {
  const dataCallback = jest.fn();
  const statusManager = makeStatusManager();
  const logger = makeLogger();

  const fdv2Payload = makePayload({ state: 'fdv2-selector' });
  const fdv1PayloadA = makePayload({ state: 'fdv1-a' });
  const fdv1PayloadB = makePayload({ state: 'fdv1-b' });

  let fdv2Created = 0;
  const fdv2Factory = jest.fn(() => {
    fdv2Created += 1;
    return makeMockSynchronizer([changeSet(fdv2Payload, { fdv1Fallback: true, fdv1FallbackTtlMs: 0 })]);
  });
  const fdv1Sync = makeMockSynchronizer([
    changeSet(fdv1PayloadA, { fdv1Fallback: true }),
    changeSet(fdv1PayloadB, { fdv1Fallback: false }),
  ]);

  const slots: SynchronizerSlot[] = [
    createSynchronizerSlot({ create: fdv2Factory }),
    createSynchronizerSlot({ create: () => fdv1Sync }, { isFDv1Fallback: true }),
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

  await statusManager.waitForState('VALID', 3);
  expect(dataCallback).toHaveBeenCalledWith(fdv1PayloadA);
  expect(dataCallback).toHaveBeenCalledWith(fdv1PayloadB);
  expect(fdv2Created).toBe(1);

  ds.close();
});

// -- fdv2 recovery scheduling --

it('logs the scheduled fdv2 retry using the directive TTL', async () => {
  const dataCallback = jest.fn();
  const statusManager = makeStatusManager();
  const logger = makeLogger();

  const fdv2Payload = makePayload({ state: 'fdv2-selector' });
  const fdv1Payload = makePayload({ state: 'fdv1-selector' });

  const fdv2Sync = makeMockSynchronizer([
    changeSet(fdv2Payload, { fdv1Fallback: true, fdv1FallbackTtlMs: 90000 }),
  ]);
  const fdv1Sync = makeMockSynchronizer([changeSet(fdv1Payload, { fdv1Fallback: false })]);

  const slots: SynchronizerSlot[] = [
    createSynchronizerSlot({ create: () => fdv2Sync }),
    createSynchronizerSlot({ create: () => fdv1Sync }, { isFDv1Fallback: true }),
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
  await statusManager.waitForState('VALID', 2);

  expect(logger.info).toHaveBeenCalledWith('FDv2 retry scheduled in 90s.');
  ds.close();
});

it('schedules the jittered default TTL when the directive carries no TTL', async () => {
  const dataCallback = jest.fn();
  const statusManager = makeStatusManager();
  const logger = makeLogger();

  const fdv2Payload = makePayload({ state: 'fdv2-selector' });
  const fdv1Payload = makePayload({ state: 'fdv1-selector' });

  const fdv2Sync = makeMockSynchronizer([changeSet(fdv2Payload, { fdv1Fallback: true })]);
  const fdv1Sync = makeMockSynchronizer([changeSet(fdv1Payload, { fdv1Fallback: false })]);

  const slots: SynchronizerSlot[] = [
    createSynchronizerSlot({ create: () => fdv2Sync }),
    createSynchronizerSlot({ create: () => fdv1Sync }, { isFDv1Fallback: true }),
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
  await statusManager.waitForState('VALID', 2);

  const scheduleLog = logger.info.mock.calls.find(
    (call: unknown[]) =>
      typeof call[0] === 'string' && call[0].startsWith('FDv2 retry scheduled in'),
  );
  expect(scheduleLog).toBeDefined();
  const seconds = Number(/in (\d+)s/.exec(scheduleLog![0] as string)![1]);
  expect(seconds).toBeGreaterThanOrEqual(internal.DEFAULT_FDV1_FALLBACK_TTL_MS / 2000);
  expect(seconds).toBeLessThanOrEqual(internal.DEFAULT_FDV1_FALLBACK_TTL_MS / 1000);

  // Cancels the pending default-length deadline so the suite does not hold a timer.
  ds.close();
});

it('reschedules without restarting the fdv1 fallback synchronizer when a directive arrives during fallback', async () => {
  const dataCallback = jest.fn();
  const statusManager = makeStatusManager();
  const logger = makeLogger();

  const fdv2Payload = makePayload({ state: 'fdv2-selector' });
  const fdv1Payload = makePayload({ state: 'fdv1-selector' });

  const fdv2Sync = makeMockSynchronizer([
    changeSet(fdv2Payload, { fdv1Fallback: true, fdv1FallbackTtlMs: 1000 }),
  ]);

  let fdv1Creations = 0;
  const fdv1Factory = () => {
    fdv1Creations += 1;
    // The fallback synchronizer's own response carries a fresh directive.
    return makeMockSynchronizer([
      changeSet(fdv1Payload, { fdv1Fallback: true, fdv1FallbackTtlMs: 5000 }),
    ]);
  };

  const slots: SynchronizerSlot[] = [
    createSynchronizerSlot({ create: () => fdv2Sync }),
    createSynchronizerSlot({ create: fdv1Factory }, { isFDv1Fallback: true }),
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
  await statusManager.waitForState('VALID', 2);
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 20);
  });

  expect(fdv1Creations).toBe(1);
  expect(logger.info).toHaveBeenCalledWith('FDv2 retry scheduled in 1s.');
  expect(logger.info).toHaveBeenCalledWith('FDv2 retry scheduled in 5s.');
  ds.close();
});

it('restarts the primary fdv2 synchronizer once the fallback TTL elapses', async () => {
  const dataCallback = jest.fn();
  const statusManager = makeStatusManager();
  const logger = makeLogger();

  const fdv2Payload = makePayload({ state: 'fdv2-selector' });
  const fdv1Payload = makePayload({ state: 'fdv1-selector' });
  const recoveredPayload = makePayload({ state: 'recovered-selector' });

  let fdv2Creations = 0;
  const fdv2Factory = () => {
    fdv2Creations += 1;
    if (fdv2Creations === 1) {
      return makeMockSynchronizer([
        changeSet(fdv2Payload, { fdv1Fallback: true, fdv1FallbackTtlMs: 20 }),
      ]);
    }
    return makeMockSynchronizer([changeSet(recoveredPayload, { fdv1Fallback: false })]);
  };

  const fdv1Sync = makeMockSynchronizer([changeSet(fdv1Payload, { fdv1Fallback: false })]);

  const slots: SynchronizerSlot[] = [
    createSynchronizerSlot({ create: fdv2Factory }),
    createSynchronizerSlot({ create: () => fdv1Sync }, { isFDv1Fallback: true }),
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
  // VALID once for the fdv2 changeSet, once for the fdv1 fallback changeSet,
  // and once for the changeSet from the restarted fdv2 synchronizer.
  await statusManager.waitForState('VALID', 3);

  expect(fdv2Creations).toBe(2);
  expect(dataCallback).toHaveBeenCalledWith(recoveredPayload);
  expect(logger.info).toHaveBeenCalledWith('Fallback TTL elapsed, restarting FDv2 data sources.');
  ds.close();
});

it('does not restart the fdv2 synchronizers before the fallback TTL elapses', async () => {
  const dataCallback = jest.fn();
  const statusManager = makeStatusManager();
  const logger = makeLogger();

  const fdv2Payload = makePayload({ state: 'fdv2-selector' });
  const fdv1Payload = makePayload({ state: 'fdv1-selector' });

  let fdv2Creations = 0;
  const fdv2Factory = () => {
    fdv2Creations += 1;
    return makeMockSynchronizer([
      changeSet(fdv2Payload, { fdv1Fallback: true, fdv1FallbackTtlMs: 10000 }),
    ]);
  };

  const fdv1Sync = makeMockSynchronizer([changeSet(fdv1Payload, { fdv1Fallback: false })]);

  const slots: SynchronizerSlot[] = [
    createSynchronizerSlot({ create: fdv2Factory }),
    createSynchronizerSlot({ create: () => fdv1Sync }, { isFDv1Fallback: true }),
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
  await statusManager.waitForState('VALID', 2);
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 30);
  });

  expect(fdv2Creations).toBe(1);
  expect(logger.info).not.toHaveBeenCalledWith(
    'Fallback TTL elapsed, restarting FDv2 data sources.',
  );
  ds.close();
});

it('restarts the fdv2 synchronizers on TTL elapse when no fdv1 fallback synchronizer is configured', async () => {
  const dataCallback = jest.fn();
  const statusManager = makeStatusManager();
  const logger = makeLogger();

  const fdv2Payload = makePayload({ state: 'fdv2-selector' });
  const recoveredPayload = makePayload({ state: 'recovered-selector' });

  let fdv2Creations = 0;
  const fdv2Factory = () => {
    fdv2Creations += 1;
    if (fdv2Creations === 1) {
      return makeMockSynchronizer([
        changeSet(fdv2Payload, { fdv1Fallback: true, fdv1FallbackTtlMs: 20 }),
      ]);
    }
    return makeMockSynchronizer([changeSet(recoveredPayload, { fdv1Fallback: false })]);
  };

  const slots: SynchronizerSlot[] = [createSynchronizerSlot({ create: fdv2Factory })];

  const ds = createFDv2DataSource({
    initializerFactories: [],
    synchronizerSlots: slots,
    dataCallback,
    statusManager,
    selectorGetter: noSelector,
    logger,
  });

  await ds.start();
  await statusManager.waitForState('VALID', 2);

  expect(fdv2Creations).toBe(2);
  expect(dataCallback).toHaveBeenCalledWith(recoveredPayload);
  ds.close();
});

it('cancels the pending recovery deadline when close is called', async () => {
  const dataCallback = jest.fn();
  const statusManager = makeStatusManager();
  const logger = makeLogger();

  const fdv2Payload = makePayload({ state: 'fdv2-selector' });
  const fdv1Payload = makePayload({ state: 'fdv1-selector' });

  const fdv2Sync = makeMockSynchronizer([
    changeSet(fdv2Payload, { fdv1Fallback: true, fdv1FallbackTtlMs: 10000 }),
  ]);
  const fdv1Sync = makeMockSynchronizer([changeSet(fdv1Payload, { fdv1Fallback: false })]);

  const slots: SynchronizerSlot[] = [
    createSynchronizerSlot({ create: () => fdv2Sync }),
    createSynchronizerSlot({ create: () => fdv1Sync }, { isFDv1Fallback: true }),
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
  await statusManager.waitForState('VALID', 2);

  // Spy installed immediately before close() so the only clearTimeout call it
  // can observe is the one that releases the recovery deadline; the condition
  // timers are cancelled later, asynchronously, when the loop unwinds.
  const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
  ds.close();
  expect(clearTimeoutSpy).toHaveBeenCalled();
  clearTimeoutSpy.mockRestore();
});

it('rejects the current attempt but keeps the recovery deadline armed when the synchronizer loop exits', async () => {
  const dataCallback = jest.fn();
  const statusManager = makeStatusManager();
  const logger = makeLogger();

  const fdv2RecoveredPayload = makePayload({ state: 'fdv2-recovered' });

  let fdv2Creations = 0;
  const fdv2Factory = () => {
    fdv2Creations += 1;
    if (fdv2Creations === 1) {
      return makeMockSynchronizer([
        terminalError(makeErrorInfo(), { fdv1Fallback: true, fdv1FallbackTtlMs: 20 }),
      ]);
    }
    return makeMockSynchronizer([changeSet(fdv2RecoveredPayload, { fdv1Fallback: false })]);
  };
  // A single slot and no FDv1 fallback slot: the terminal error blocks the
  // only slot, so the loop exits with a deadline still armed.
  const slots: SynchronizerSlot[] = [createSynchronizerSlot({ create: fdv2Factory })];

  const ds = createFDv2DataSource({
    initializerFactories: [],
    synchronizerSlots: slots,
    dataCallback,
    statusManager,
    selectorGetter: noSelector,
    logger,
  });

  await expect(ds.start()).rejects.toThrow('All data sources exhausted without receiving data.');

  // The rejection above did not cancel the deadline -- it fires later and
  // restarts the synchronizer via sourceManager.fdv2Recovery().
  await statusManager.waitForState('VALID', 1);
  expect(fdv2Creations).toBe(2);
  expect(dataCallback).toHaveBeenCalledWith(fdv2RecoveredPayload);
  expect(logger.info).toHaveBeenCalledWith('Fallback TTL elapsed, restarting FDv2 data sources.');

  ds.close();
});

it('cancels the pending recovery deadline when an initializer throws after arming it', async () => {
  const dataCallback = jest.fn();
  const statusManager = makeStatusManager();
  const logger = makeLogger();

  // First initializer carries a directive with no payload data, so it arms
  // the recovery deadline without ever calling dataCallback, then the loop
  // moves on to the next initializer. There is no fdv1 fallback slot, so
  // handleFdv1Fallback does not break the loop early.
  const armingInit = makeMockInitializer(
    changeSet(makePayload({ type: 'none' }), { fdv1Fallback: true, fdv1FallbackTtlMs: 10000 }),
  );

  // Second initializer throws before runSynchronizers ever starts, exercising
  // the uncaught-exception-during-initialization path.
  const throwingInit: Initializer = {
    run: () => Promise.reject(new Error('initializer failure')),
    close: jest.fn(),
  };

  const ds = createFDv2DataSource({
    initializerFactories: [makeInitFactory(armingInit), makeInitFactory(throwingInit)],
    synchronizerSlots: [],
    dataCallback,
    statusManager,
    selectorGetter: noSelector,
    logger,
  });

  const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

  await expect(ds.start()).rejects.toThrow('initializer failure');

  expect(clearTimeoutSpy).toHaveBeenCalled();
  clearTimeoutSpy.mockRestore();
  ds.close();
});

// -- background recovery continuation --

it('keeps recovering after an already-elapsed deadline is discovered at exhaustion', async () => {
  // The exhaustion branch must handle a deadline that is ALREADY resolved
  // when it checks recoveryTimer.promise -- rather than merely arming a
  // short TTL and hoping the check lands late.
  //
  // Two things have to line up for that precondition to occur:
  //  1. The deadline has to elapse while nothing is actively racing it. The
  //     main synchronizer loop always re-reads recoveryTimer.promise fresh on
  //     each iteration and races it live, so an elapsed deadline is normally
  //     caught there, not by the exhaustion branch. The one place that never
  //     races the deadline is initializer processing, so a short TTL armed by
  //     the first initializer, followed by a second initializer that takes
  //     real wall-clock time (via an actual setTimeout, comfortably longer
  //     than the TTL) to resolve, elapses the deadline "off to the side."
  //  2. Once synchronizers start, the deadline's own promise and the mock
  //     synchronizer's (already-resolved) result promise are both settled by
  //     the time Promise.race is called. Promise.race resolves in favor of
  //     whichever racer's handler was registered first for already-settled
  //     inputs, and the code always lists the sync result first -- so the
  //     terminal error "wins," blocks the only slot, and only THEN does the
  //     outer loop's exhaustion check discover the stale, already-elapsed
  //     deadline promise.
  const dataCallback = jest.fn();
  const statusManager = makeStatusManager();
  const logger = makeLogger();

  const secondRecoveryPayload = makePayload({ state: 'second-recovery' });

  // Arms a 5ms recovery deadline, without itself carrying data or blocking
  // the initializer chain.
  const armingInit = makeMockInitializer(
    changeSet(makePayload({ type: 'none', state: '' }), {
      fdv1Fallback: true,
      fdv1FallbackTtlMs: 5,
    }),
  );
  // Resolves only after a real 20ms delay -- comfortably longer than the 5ms
  // deadline above, so that deadline has genuinely elapsed in wall-clock time
  // by the time this initializer (and thus initialization as a whole)
  // finishes, well before any synchronizer has started racing it.
  const delayingInit: Initializer = {
    run: () =>
      new Promise<FDv2SourceResult>((resolve) => {
        setTimeout(() => {
          resolve(changeSet(makePayload({ type: 'none', state: '' }), { fdv1Fallback: false }));
        }, 20);
      }),
    close: jest.fn(),
  };

  let fdv2Creations = 0;
  const fdv2Factory = () => {
    fdv2Creations += 1;
    if (fdv2Creations === 1) {
      // Does not carry a directive: the stale deadline armed by armingInit
      // is left untouched, so it is what the exhaustion branch discovers.
      return makeMockSynchronizer([terminalError(makeErrorInfo(), { fdv1Fallback: false })]);
    }
    if (fdv2Creations === 2) {
      // Recovers, but immediately falls back again with a second short TTL --
      // this forces a second exhaustion-with-pending-recovery pass, proving
      // recovery still works after the first cycle.
      return makeMockSynchronizer([
        terminalError(makeErrorInfo(), { fdv1Fallback: true, fdv1FallbackTtlMs: 5 }),
      ]);
    }
    return makeMockSynchronizer([changeSet(secondRecoveryPayload, { fdv1Fallback: false })]);
  };
  const slots: SynchronizerSlot[] = [createSynchronizerSlot({ create: fdv2Factory })];

  const ds = createFDv2DataSource({
    initializerFactories: [makeInitFactory(armingInit), makeInitFactory(delayingInit)],
    synchronizerSlots: slots,
    dataCallback,
    statusManager,
    selectorGetter: noSelector,
    logger,
  });

  await expect(ds.start()).rejects.toThrow('All data sources exhausted without receiving data.');

  await statusManager.waitForState('VALID', 1);
  expect(fdv2Creations).toBe(3);
  expect(dataCallback).toHaveBeenCalledWith(secondRecoveryPayload);

  ds.close();
});

it('does not act on a background recovery continuation if close is called first', async () => {
  const dataCallback = jest.fn();
  const statusManager = makeStatusManager();
  const logger = makeLogger();

  const fdv2Sync = makeMockSynchronizer([
    terminalError(makeErrorInfo(), { fdv1Fallback: true, fdv1FallbackTtlMs: 30 }),
  ]);
  const slots: SynchronizerSlot[] = [createSynchronizerSlot({ create: () => fdv2Sync })];

  const ds = createFDv2DataSource({
    initializerFactories: [],
    synchronizerSlots: slots,
    dataCallback,
    statusManager,
    selectorGetter: noSelector,
    logger,
  });

  await expect(ds.start()).rejects.toThrow('All data sources exhausted without receiving data.');
  ds.close();

  await new Promise<void>((resolve) => {
    setTimeout(resolve, 60);
  });

  expect(logger.info).not.toHaveBeenCalledWith('Fallback TTL elapsed, restarting FDv2 data sources.');
});

it('does not arm a background recovery continuation with zero synchronizer slots', async () => {
  const dataCallback = jest.fn();
  const statusManager = makeStatusManager();
  const logger = makeLogger();

  const initializer = makeMockInitializer(
    changeSet(makePayload({ type: 'none', state: '' }), { fdv1Fallback: true, fdv1FallbackTtlMs: 30 }),
  );

  const ds = createFDv2DataSource({
    initializerFactories: [makeInitFactory(initializer)],
    synchronizerSlots: [],
    dataCallback,
    statusManager,
    selectorGetter: noSelector,
    logger,
  });

  const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
  await expect(ds.start()).rejects.toThrow('All data sources exhausted without receiving data.');
  expect(clearTimeoutSpy).toHaveBeenCalled();
  clearTimeoutSpy.mockRestore();

  await new Promise<void>((resolve) => {
    setTimeout(resolve, 60);
  });

  expect(logger.info).not.toHaveBeenCalledWith(
    'Fallback TTL elapsed, restarting FDv2 data sources.',
  );
  ds.close();
});

it('closes a deadline armed and abandoned by a later recovery generation', async () => {
  // A background recovery continuation can hand off to a recursive call that
  // itself arms a fresh deadline (a new directive) and then returns normally
  // -- via a shutdown result -- without going through the exhaustion branch
  // that would otherwise arm its own continuation. Whichever generation
  // returns normally without handing off is responsible for closing the
  // timer, so the fresh deadline must not survive as a dangling timer.
  const dataCallback = jest.fn();
  const statusManager = makeStatusManager();
  const logger = makeLogger();

  let fdv2Creations = 0;
  const fdv2Factory = () => {
    fdv2Creations += 1;
    if (fdv2Creations === 1) {
      // First generation: blocks the primary slot and arms a short deadline,
      // switching to the fallback slot.
      return makeMockSynchronizer([
        terminalError(makeErrorInfo(), { fdv1Fallback: true, fdv1FallbackTtlMs: 5 }),
      ]);
    }
    // Second generation (after the continuation recovers): blocks the
    // primary slot again and arms a fresh deadline -- long enough that it
    // could not have elapsed naturally by the time the assertion below
    // runs -- before switching back to the fallback slot.
    return makeMockSynchronizer([
      terminalError(makeErrorInfo(), { fdv1Fallback: true, fdv1FallbackTtlMs: 500 }),
    ]);
  };

  let fallbackCreations = 0;
  const fallbackFactory = () => {
    fallbackCreations += 1;
    if (fallbackCreations === 1) {
      // First generation: blocks the fallback slot too, without carrying a
      // directive, so all slots end up blocked while the short deadline is
      // still pending -- this is what arms the continuation.
      return makeMockSynchronizer([terminalError(makeErrorInfo(), { fdv1Fallback: false })]);
    }
    // Second generation: returns normally via shutdown, without the
    // exhaustion branch ever running, even though a fresh deadline is armed.
    return makeMockSynchronizer([shutdown()]);
  };

  const slots: SynchronizerSlot[] = [
    createSynchronizerSlot({ create: fdv2Factory }),
    createSynchronizerSlot({ create: fallbackFactory }, { isFDv1Fallback: true }),
  ];

  const ds = createFDv2DataSource({
    initializerFactories: [],
    synchronizerSlots: slots,
    dataCallback,
    statusManager,
    selectorGetter: noSelector,
    logger,
  });

  await expect(ds.start()).rejects.toThrow('All data sources exhausted without receiving data.');

  const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

  // Long enough for the short (5ms) deadline to elapse and for the second
  // generation to run to completion (all synchronous/microtask work), but
  // far short of the fresh 500ms deadline armed during that generation --
  // so any clearTimeout call observed here can only be the orchestrator
  // proactively closing that still-live deadline, not it elapsing on its
  // own or ds.close() below cleaning it up after the fact.
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 30);
  });

  expect(fdv2Creations).toBe(2);
  expect(fallbackCreations).toBe(2);
  // Exactly one call: the abandoned 500ms deadline being proactively closed.
  // Generation 1's own (already-fired) timer never calls clearTimeout, since
  // its handle is already cleared by the time anything observes it elapsed.
  expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
  clearTimeoutSpy.mockRestore();

  ds.close();
});

