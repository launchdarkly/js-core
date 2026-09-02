import { internal, LDLogger } from '@launchdarkly/js-sdk-common';

import { DataSourceStatusManager } from '../DataSourceStatusManager';
import {
  ConditionGroup,
  ConditionType,
  DEFAULT_FALLBACK_TIMEOUT_MS,
  DEFAULT_INIT_FALLBACK_TIMEOUT_MS,
  DEFAULT_RECOVERY_TIMEOUT_MS,
  getConditions,
} from './Conditions';
import { createFDv2RecoveryTimer } from './FDv2RecoveryTimer';
import { ChangeSetResult, FDv2SourceResult, StatusResult } from './FDv2SourceResult';
import { createSourceManager, InitializerFactory, SynchronizerSlot } from './SourceManager';

/**
 * Callback invoked when the orchestrator produces a changeSet payload.
 */
export type DataCallback = (payload: internal.Payload) => void;

/**
 * Configuration for the {@link FDv2DataSource} orchestrator.
 */
export interface FDv2DataSourceConfig {
  /** Ordered list of initializer factories. */
  initializerFactories: InitializerFactory[];

  /** Ordered list of synchronizer slots with state. */
  synchronizerSlots: SynchronizerSlot[];

  /** Callback to deliver payloads to the consuming layer. */
  dataCallback: DataCallback;

  /** Status manager for reporting data source state transitions. */
  statusManager: DataSourceStatusManager;

  /**
   * Getter for the current selector (basis) string. The selector is managed
   * externally by the consuming layer; the orchestrator reads it via this
   * getter and passes it through to source factories.
   */
  selectorGetter: () => string | undefined;

  /** Optional logger. */
  logger?: LDLogger;

  /** Fallback condition timeout in ms (default 120s). */
  fallbackTimeoutMs?: number;

  /** Recovery condition timeout in ms (default 300s). */
  recoveryTimeoutMs?: number;

  /**
   * Not-yet-initialized fallback leg timeout in ms (default 10s). Fires if
   * the data system has never received data within this long of the current
   * synchronizer becoming active.
   */
  initFallbackTimeoutMs?: number;
}

/**
 * The FDv2 data source orchestrator. Coordinates initializers and
 * synchronizers to provide a resilient flag data pipeline.
 */
export interface FDv2DataSource {
  /**
   * Start the orchestration loop. Returns a promise that resolves when
   * initialization is complete (first basis data received or all initializers
   * exhausted with data). The orchestration loop continues running in the
   * background after the promise resolves, driving synchronizers.
   */
  start(): Promise<void>;

  /** Close the orchestrator. Stops all active sources. */
  close(): void;
}

type RaceResult =
  | { source: 'sync'; value: FDv2SourceResult }
  | { source: 'condition'; value: ConditionType }
  | { source: 'fdv2Recovery' };

/**
 * Creates an {@link FDv2DataSource} orchestrator.
 */
export function createFDv2DataSource(config: FDv2DataSourceConfig): FDv2DataSource {
  const {
    initializerFactories,
    synchronizerSlots,
    dataCallback,
    statusManager,
    selectorGetter,
    logger,
    fallbackTimeoutMs = DEFAULT_FALLBACK_TIMEOUT_MS,
    recoveryTimeoutMs = DEFAULT_RECOVERY_TIMEOUT_MS,
    initFallbackTimeoutMs = DEFAULT_INIT_FALLBACK_TIMEOUT_MS,
  } = config;

  let initialized = false;
  let closed = false;
  let dataReceived = false;
  let initResolve: (() => void) | undefined;
  let initReject: ((err: Error) => void) | undefined;

  // When every initializer is a cache initializer and there are no
  // synchronizers, the cache is the only possible data source. A cache miss
  // in that configuration must not fail initialization -- there is nowhere
  // else for data to come from, and reporting an error would be meaningless.
  const cacheOnlyDataSystem =
    initializerFactories.length > 0 &&
    initializerFactories.every((f) => f.isCache === true) &&
    synchronizerSlots.length === 0;

  const sourceManager = createSourceManager(
    initializerFactories,
    synchronizerSlots,
    selectorGetter,
  );

  // Deadline for returning to FDv2 after the server directed a fallback to
  // FDv1. It outlives individual synchronizer runs: it is armed while an FDv2
  // source is active and must survive the switch to the fallback synchronizer.
  const recoveryTimer = createFDv2RecoveryTimer();

  function markInitialized() {
    if (!initialized) {
      initialized = true;
      initResolve?.();
      initResolve = undefined;
      initReject = undefined;
    }
  }

  function applyChangeSet(result: ChangeSetResult) {
    dataCallback(result.payload);
    statusManager.requestStateUpdate('VALID');
  }

  function reportStatusError(result: StatusResult) {
    if (result.errorInfo) {
      statusManager.reportError(
        result.errorInfo.kind,
        result.errorInfo.message,
        result.errorInfo.statusCode,
        result.state === 'interrupted',
      );
    }
  }

  /**
   * Arms the deadline for returning to FDv2 and reports it. A directive whose
   * TTL did not survive parsing falls back to the jittered default, so there is
   * always a concrete deadline.
   */
  function scheduleFdv2Recovery(result: FDv2SourceResult) {
    const ttlMs = result.fdv1FallbackTtlMs ?? internal.resolveFallbackTtlMs(undefined);
    recoveryTimer.schedule(ttlMs);
    logger?.info(`FDv2 retry scheduled in ${Math.round(ttlMs / 1000)}s.`);
  }

  /**
   * Clears the recovery deadline and restarts FDv2. Only one caller ever
   * observes a given deadline elapse -- the main synchronizer loop and a
   * background continuation are never both live for the same deadline at
   * once -- so this never double-applies.
   */
  function applyFdv2Recovery() {
    recoveryTimer.clear();
    logger?.info('Fallback TTL elapsed, restarting FDv2 data sources.');
    sourceManager.fdv2Recovery();
  }

  function handleFdv1Fallback(result: FDv2SourceResult): boolean {
    if (!result.fdv1Fallback) {
      return false;
    }

    // Guard: if the FDv1 fallback synchronizer itself produces a result flagged
    // fdv1Fallback, do not re-run the fallback machinery - we are already on
    // FDv1. Its own traffic legitimately supersedes the pending deadline with
    // the new TTL.
    if (sourceManager.isCurrentSynchronizerFDv1Fallback) {
      scheduleFdv2Recovery(result);
      return false;
    }

    // A directive observed while a deadline is already pending, but not from
    // the FDv1 synchronizer's own traffic, is a repeated signal from a source
    // that has not yet transitioned off FDv2 (e.g. because no FDv1 fallback
    // synchronizer is configured, so the FDv2 source keeps running). The
    // first directive's TTL already governs the return to FDv2; a repeat
    // must not keep re-arming the deadline, or it could never elapse.
    if (recoveryTimer.promise === undefined) {
      scheduleFdv2Recovery(result);
    }

    if (sourceManager.hasFDv1Fallback()) {
      sourceManager.fdv1Fallback();
      return true;
    }
    return false;
  }

  // The orchestration loops intentionally use await-in-loop for sequential
  // state machine processing, one result at a time.
  async function runInitializers(): Promise<void> {
    // Tracks whether any initializer reported interrupted/terminal_error.
    // Used below so the cache-only exhaustion branch does not overwrite
    // that error status with VALID.
    let errorReportedDuringInit = false;

    while (!closed) {
      const initializer = sourceManager.getNextInitializerAndSetActive();
      if (initializer === undefined) {
        break;
      }

      // eslint-disable-next-line no-await-in-loop
      const result = await initializer.run();
      if (closed) {
        return;
      }

      if (result.type === 'changeSet' && result.payload.type !== 'none') {
        applyChangeSet(result);

        // Data was received. Recorded before the fallback check below so that
        // a directive arriving alongside a payload still counts as
        // initialization data; the exhaustion branch marks initialization
        // complete in that case.
        dataReceived = true;
      } else if (result.type === 'status') {
        switch (result.state) {
          case 'interrupted':
          case 'terminal_error':
            logger?.warn(`Initializer failed: ${result.errorInfo?.message ?? 'unknown error'}`);
            reportStatusError(result);
            errorReportedDuringInit = true;
            break;
          case 'shutdown':
            return;
          case 'goodbye':
            break;
          default:
            break;
        }
      }

      // Check for FDv1 fallback after all result handling, in one place. Any
      // result can carry the directive, including a changeSet with a 'none'
      // payload (an unchanged poll response), so the check must not be gated
      // on the result type or the payload type. No further initializers run
      // once the server has directed the SDK off FDv2; the FDv1 fallback
      // synchronizer takes over.
      if (handleFdv1Fallback(result)) {
        break;
      }

      if (result.type === 'changeSet' && result.payload.type !== 'none' && result.payload.state) {
        // Got basis data with a selector -- initialization is complete.
        markInitialized();
        return;
      }

      // Otherwise (data with no selector, e.g. cache; or a non-fatal status)
      // continue to the next initializer.
    }

    // close() between the last loop iteration and the exhaustion branch.
    // Exit without marking initialized or emitting a spurious VALID; the
    // start() promise will be rejected by the post-orchestration handler
    // with "closed before initialization completed."
    if (closed) {
      return;
    }

    // All initializers exhausted.
    if (cacheOnlyDataSystem) {
      // Cache-only data system with no synchronizer to produce a VALID
      // status on its own. On a cache miss with no errors, nothing else
      // has asserted VALID yet, so do it here. Skip the update if:
      //   - dataReceived (cache hit): applyChangeSet already asserted VALID.
      //   - errorReportedDuringInit: reportError set an error status that
      //     must not be silently overwritten.
      if (!dataReceived && !errorReportedDuringInit) {
        statusManager.requestStateUpdate('VALID');
      }
      markInitialized();
    } else if (dataReceived) {
      // At least one initializer delivered data. Do not overwrite any
      // error status that a subsequent failed initializer may have
      // reported -- the status will be driven by the synchronizers.
      markInitialized();
    }
  }

  /**
   * @returns `true` if a background continuation has taken over
   *   responsibility for `recoveryTimer` -- the caller must then leave it
   *   alone rather than closing it.
   */
  async function runSynchronizers(): Promise<boolean> {
    while (!closed) {
      const synchronizer = sourceManager.getNextAvailableSynchronizerAndSetActive();
      if (synchronizer === undefined) {
        // Every slot is currently blocked. If a recovery deadline is still
        // armed and there is at least one synchronizer slot for it to
        // unblock, don't hold up this attempt on it -- settle it now, and
        // arm a background continuation that takes over responsibility for
        // `recoveryTimer`, restarting FDv2 on its own once the deadline
        // elapses. The returned boolean tells every caller (this call's
        // caller, and the continuation's own recursive call below) whether
        // it can close the timer itself or whether responsibility has been
        // handed off elsewhere.
        const pendingDeadline = recoveryTimer.promise;
        const handingOff = pendingDeadline !== undefined && synchronizerSlots.length > 0;
        if (handingOff) {
          pendingDeadline
            .then(() => {
              if (closed) {
                return;
              }
              applyFdv2Recovery();
              void runSynchronizers()
                .then((handedOff) => {
                  if (!handedOff) {
                    recoveryTimer.close();
                  }
                })
                .catch((err) => {
                  logger?.error(`Orchestration error during recovery: ${err}`);
                  recoveryTimer.close();
                });
            })
            .catch((err) => {
              logger?.error(`Error during background FDv2 recovery: ${err}`);
            });
        }
        if (!initialized) {
          initReject?.(new Error('All data sources exhausted without receiving data.'));
          initResolve = undefined;
          initReject = undefined;
        }
        return handingOff;
      }

      const conditions: ConditionGroup = getConditions(
        sourceManager.getAvailableSynchronizerCount(),
        sourceManager.isPrimeSynchronizer(),
        initialized,
        fallbackTimeoutMs,
        recoveryTimeoutMs,
        initFallbackTimeoutMs,
      );

      if (conditions.promise) {
        logger?.debug('Fallback condition active for current synchronizer.');
      }

      // Conditions hold timers; close them even if the inner loop throws or breaks early.
      let synchronizerRunning = true;
      try {
        while (!closed && synchronizerRunning) {
          const syncPromise: Promise<RaceResult> = synchronizer
            .next()
            .then((value) => ({ source: 'sync' as const, value }));

          const racers: Promise<RaceResult>[] = [syncPromise];
          if (conditions.promise !== undefined) {
            racers.push(
              conditions.promise.then((value) => ({ source: 'condition' as const, value })),
            );
          }
          // Read the deadline fresh each iteration: it is armed part-way
          // through the loop, when a directive arrives.
          const recoveryPromise = recoveryTimer.promise;
          if (recoveryPromise !== undefined) {
            racers.push(recoveryPromise.then(() => ({ source: 'fdv2Recovery' as const })));
          }

          // eslint-disable-next-line no-await-in-loop
          const winner = await Promise.race(racers);
          if (closed) {
            return false;
          }

          if (winner.source === 'fdv2Recovery') {
            // Unblocks the FDv2 slots, blocks the FDv1 fallback slot and rewinds
            // to the primary. The outer loop then starts the primary FDv2
            // synchronizer, which closes the fallback synchronizer first, so
            // only ever one source writes to the store.
            applyFdv2Recovery();
            synchronizerRunning = false;
          } else if (winner.source === 'condition') {
            const conditionType = winner.value as ConditionType;

            if (conditionType === 'fallback') {
              logger?.warn('Fallback condition fired, moving to next synchronizer.');
            } else if (conditionType === 'recovery') {
              logger?.info('Recovery condition fired, resetting to primary synchronizer.');
              sourceManager.resetSourceIndex();
            }

            synchronizerRunning = false;
          } else {
            // Synchronizer produced a result.
            const syncResult = winner.value as FDv2SourceResult;
            conditions.inform(syncResult);

            if (syncResult.type === 'changeSet') {
              applyChangeSet(syncResult);
              // A 'none' payload (e.g. an unchanged poll response) carries no
              // data, so it must not count toward "initialized with data" --
              // matching the initializer phase's same payload.type check.
              if (!initialized && syncResult.payload.type !== 'none') {
                markInitialized();
              }
            } else if (syncResult.type === 'status') {
              switch (syncResult.state) {
                case 'interrupted':
                  logger?.warn(
                    `Synchronizer interrupted: ${syncResult.errorInfo?.message ?? 'unknown error'}`,
                  );
                  reportStatusError(syncResult);
                  break;
                case 'terminal_error':
                  logger?.error(
                    `Synchronizer terminal error: ${syncResult.errorInfo?.message ?? 'unknown error'}`,
                  );
                  reportStatusError(syncResult);
                  sourceManager.blockCurrentSynchronizer();
                  synchronizerRunning = false;
                  break;
                case 'shutdown':
                  return false;
                case 'goodbye':
                  // The synchronizer will handle reconnection internally.
                  break;
                default:
                  break;
              }
            }

            // Check for FDv1 fallback after all result handling, in one place.
            if (handleFdv1Fallback(syncResult)) {
              synchronizerRunning = false;
            }
          }
        }
      } finally {
        conditions.close();
      }
    }
    return false;
  }

  async function runOrchestration(): Promise<void> {
    // No sources configured at all, so there is nothing to wait for.
    // Report valid immediately.
    if (initializerFactories.length === 0 && synchronizerSlots.length === 0) {
      statusManager.requestStateUpdate('VALID');
      markInitialized();
      return;
    }

    let handedOff = false;
    try {
      await runInitializers();
      if (!closed) {
        handedOff = await runSynchronizers();
      }
    } finally {
      // The deadline can be armed from either phase (an initializer or a
      // synchronizer observing a directive), so it is released here once
      // orchestration is done for good, whether by normal completion or by
      // throw, unless a background continuation (armed when every slot was
      // blocked but a deadline was still pending) has taken over
      // responsibility for it and will restart FDv2 later.
      if (!handedOff) {
        recoveryTimer.close();
      }
    }
  }

  return {
    start(): Promise<void> {
      return new Promise<void>((resolve, reject) => {
        initResolve = resolve;
        initReject = reject;
        statusManager.requestStateUpdate('INITIALIZING');

        runOrchestration()
          .then(() => {
            // Orchestration completed without error. If the init promise was
            // never resolved (e.g., close() called during init, or all sources
            // exhausted without data and no synchronizers), resolve it now.
            // This prevents the start() promise from hanging forever.
            if (!initialized) {
              initReject?.(new Error('Data source closed before initialization completed.'));
              initResolve = undefined;
              initReject = undefined;
            }
          })
          .catch((err) => {
            if (!initialized) {
              initReject?.(err instanceof Error ? err : new Error(String(err)));
              initResolve = undefined;
              initReject = undefined;
            } else {
              logger?.error(`Orchestration error: ${err}`);
            }
          });
      });
    },

    close() {
      closed = true;
      recoveryTimer.close();
      sourceManager.close();
    },
  };
}
