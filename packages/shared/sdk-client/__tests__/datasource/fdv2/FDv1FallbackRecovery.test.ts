import { createFDv2DataSource } from '../../../src/datasource/fdv2/FDv2DataSource';
import {
  changeSet,
  FDv2SourceResult,
  interrupted,
  shutdown,
} from '../../../src/datasource/fdv2/FDv2SourceResult';
import { createSynchronizerSlot } from '../../../src/datasource/fdv2/SourceManager';
import { Synchronizer } from '../../../src/datasource/fdv2/Synchronizer';
import {
  makeErrorInfo,
  makeLogger,
  makeMockSynchronizer,
  makePayload,
  makeStatusManager,
  noSelector,
} from './orchestrationTestHelpers';

/**
 * A synchronizer that emits a new result every `intervalMs`, forever, until
 * closed. Unlike `makeMockSynchronizer` (a fixed sequence that then blocks),
 * this models a real endpoint that keeps talking -- e.g. a polling
 * synchronizer whose every response carries the fallback directive header.
 */
function makeTickingSynchronizer(
  makeResult: () => FDv2SourceResult,
  intervalMs: number,
): Synchronizer {
  let closed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    next(): Promise<FDv2SourceResult> {
      if (closed) {
        return Promise.resolve(shutdown());
      }
      return new Promise<FDv2SourceResult>((resolve) => {
        timer = setTimeout(() => {
          resolve(closed ? shutdown() : makeResult());
        }, intervalMs);
      });
    },
    close() {
      closed = true;
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    },
  };
}

it('does not let a directive repeated faster than its TTL starve FDv2 recovery (no FDv1 slot configured)', async () => {
  const statusManager = makeStatusManager();
  const logger = makeLogger();

  // No FDv1 fallback slot: per the pre-existing gap, the active FDv2
  // synchronizer is never stopped on a directive, so it keeps running and
  // keeps producing directive-carrying results (e.g. a polling synchronizer
  // whose every response carries "X-LD-FD-Fallback: true").
  const sync = makeTickingSynchronizer(
    () => interrupted(makeErrorInfo(), { fdv1Fallback: true, fdv1FallbackTtlMs: 30 }),
    8, // faster than the 30ms TTL -- each result used to re-arm the deadline before it fired
  );

  const ds = createFDv2DataSource({
    initializerFactories: [],
    synchronizerSlots: [createSynchronizerSlot({ create: () => sync })],
    dataCallback: jest.fn(),
    statusManager,
    logger,
    selectorGetter: noSelector,
  });

  const startPromise = ds.start();
  startPromise.catch(() => {});

  await new Promise((resolve) => {
    setTimeout(resolve, 200);
  });
  ds.close();

  const infoCalls = logger.info.mock.calls.map((c) => String(c[0]));
  const scheduleLogs = infoCalls.filter((m) => m.includes('retry scheduled')).length;
  const recoveredLogs = infoCalls.filter((m) => m.includes('restarting FDv2')).length;

  // handleFdv1Fallback() only re-arms the deadline once per Directed Fallback
  // engagement -- a repeated directive from a source that has not
  // transitioned off FDv2 does not keep resetting it.
  expect(scheduleLogs).toBe(1);
  // The deadline set by the first directive is honored: the SDK returns to
  // FDv2 once it elapses, per DATASYSTEM v2 Requirement 1.6.4.1.
  expect(recoveredLogs).toBeGreaterThan(0);
});

it('does not let a data-less "none" changeSet mark the data system initialized or disarm the 10s init-fallback leg', async () => {
  const statusManager = makeStatusManager();

  const nonePayload = makePayload({ type: 'none', state: '' });
  const primary = makeMockSynchronizer([changeSet(nonePayload, { fdv1Fallback: false })]);
  const secondaryFactory = { create: jest.fn(() => makeMockSynchronizer([])) };

  const ds = createFDv2DataSource({
    initializerFactories: [],
    synchronizerSlots: [
      createSynchronizerSlot({ create: () => primary }),
      createSynchronizerSlot(secondaryFactory),
    ],
    dataCallback: jest.fn(),
    statusManager,
    selectorGetter: noSelector,
    initFallbackTimeoutMs: 15,
    fallbackTimeoutMs: 1_000_000,
  });

  let resolved = false;
  const startPromise = ds.start();
  // start() rejects once the orchestrator exhausts its sources (or is
  // closed) without ever initializing; that rejection is expected and
  // irrelevant to this assertion, so it must not surface as an unhandled
  // rejection -- both branches of this single chain handle it.
  startPromise.then(
    () => {
      resolved = true;
    },
    () => {},
  );

  // Give the 10s ("15ms" in this test) init-fallback leg a chance to fire
  // and move the orchestrator on to the secondary synchronizer.
  await new Promise((resolve) => {
    setTimeout(resolve, 60);
  });

  // Conditions.ts's createInitFallbackCondition() requires
  // `payload.type !== 'none'` to cancel the leg, so a data-less response
  // does not disarm it and the secondary synchronizer is tried.
  expect(secondaryFactory.create).toHaveBeenCalled();
  // FDv2DataSource.ts's synchronizer-phase changeSet handler requires the
  // same check before calling markInitialized(), matching the initializer
  // phase, so start() must not resolve on a response with no real data.
  // Checked before close() -- close() itself rejects the still-pending
  // start() promise, which must not be mistaken for a resolution here.
  expect(resolved).toBe(false);
  ds.close();
});

it('does not churn synchronizers on a "none" changeSet when the data system already has existing data', async () => {
  const statusManager = makeStatusManager();

  // Models a connection-mode switch after the SDK was already initialized:
  // a new FDv2DataSource instance is created, but the server has nothing
  // new to say -- a 'none' response is the correct, healthy answer, not
  // evidence of an uninitialized system.
  const nonePayload = makePayload({ type: 'none', state: '' });
  const primary = makeMockSynchronizer([changeSet(nonePayload, { fdv1Fallback: false })]);
  const secondaryFactory = { create: jest.fn(() => makeMockSynchronizer([])) };

  const ds = createFDv2DataSource({
    initializerFactories: [],
    synchronizerSlots: [
      createSynchronizerSlot({ create: () => primary }),
      createSynchronizerSlot(secondaryFactory),
    ],
    dataCallback: jest.fn(),
    statusManager,
    selectorGetter: noSelector,
    initFallbackTimeoutMs: 15,
    fallbackTimeoutMs: 1_000_000,
    hasExistingData: true,
  });

  await ds.start();

  // Give the 10s ("15ms" in this test) init-fallback leg a chance to fire
  // -- it must not, because hasExistingData suppresses it entirely.
  await new Promise((resolve) => {
    setTimeout(resolve, 60);
  });
  ds.close();

  expect(secondaryFactory.create).not.toHaveBeenCalled();
});
