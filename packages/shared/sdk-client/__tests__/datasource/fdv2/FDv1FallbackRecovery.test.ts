import { createFDv2DataSource } from '../../../src/datasource/fdv2/FDv2DataSource';
import {
  FDv2SourceResult,
  interrupted,
  shutdown,
} from '../../../src/datasource/fdv2/FDv2SourceResult';
import { createSynchronizerSlot } from '../../../src/datasource/fdv2/SourceManager';
import { Synchronizer } from '../../../src/datasource/fdv2/Synchronizer';
import {
  makeErrorInfo,
  makeLogger,
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

it('schedules FDv2 recovery once and honors the TTL (no FDv1 slot configured)', async () => {
  const statusManager = makeStatusManager();
  const logger = makeLogger();

  // No FDv1 fallback slot: the first directive halts and closes this
  // synchronizer (every slot is blocked with nothing to unblock), so it
  // never gets the chance to tick again before recovery.
  const sync = makeTickingSynchronizer(
    () => interrupted(makeErrorInfo(), { fdv1Fallback: true, fdv1FallbackTtlMs: 30 }),
    8, // faster than the 30ms TTL, in case the halt ever stopped applying
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

  // Exactly one directive is ever processed, since halting the source on
  // the first one leaves it with no chance to tick again before recovery.
  expect(scheduleLogs).toBe(1);
  // The deadline set by that directive is honored: the SDK returns to FDv2
  // once it elapses.
  expect(recoveredLogs).toBeGreaterThan(0);
});
