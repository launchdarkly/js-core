import { LDLogger } from '@launchdarkly/js-sdk-common';

import { DataSourceStatusManager } from '../DataSourceStatusManager';
import {
  ConditionGroup,
  ConditionType,
  DEFAULT_FALLBACK_TIMEOUT_MS,
  DEFAULT_RECOVERY_TIMEOUT_MS,
  getConditions,
} from './Conditions';
import { ChangeSetResult, FDv2SourceResult, StatusResult } from './FDv2SourceResult';
import { createSourceManager, InitializerFactory, SynchronizerSlot } from './SourceManager';

/**
 * Callback invoked when the orchestrator produces a changeSet result.
 * Receives the full {@link ChangeSetResult} so consumers have access to both
 * the payload and metadata (environmentId, fdv1Fallback).
 */
export type DataCallback = (result: ChangeSetResult) => void;

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
   * externally by the consuming layer — the orchestrator reads it via this
   * getter and passes it through to source factories.
   */
  selectorGetter: () => string | undefined;

  /** Optional logger. */
  logger?: LDLogger;

  /** Fallback condition timeout in ms (default 120s). */
  fallbackTimeoutMs?: number;

  /** Recovery condition timeout in ms (default 300s). */
  recoveryTimeoutMs?: number;
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
  | { source: 'condition'; value: ConditionType };

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
  } = config;

  let initialized = false;
  let closed = false;
  let dataReceived = false;
  let initResolve: (() => void) | undefined;
  let initReject: ((err: Error) => void) | undefined;

  const sourceManager = createSourceManager(
    initializerFactories,
    synchronizerSlots,
    selectorGetter,
  );

  function markInitialized() {
    if (!initialized) {
      initialized = true;
      initResolve?.();
      initResolve = undefined;
      initReject = undefined;
    }
  }

  function applyChangeSet(result: ChangeSetResult) {
    dataCallback(result);
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

  function handleFdv1Fallback(result: FDv2SourceResult): boolean {
    if (result.fdv1Fallback && sourceManager.hasFDv1Fallback()) {
      sourceManager.fdv1Fallback();
      return true;
    }
    return false;
  }

  /* eslint-disable no-await-in-loop */
  // The orchestration loops intentionally use await-in-loop for sequential
  // state machine processing — one result at a time.
  async function runInitializers(): Promise<void> {
    while (!closed) {
      const initializer = sourceManager.getNextInitializerAndSetActive();
      if (initializer === undefined) {
        break;
      }

      const result = await initializer.run();
      if (closed) {
        return;
      }

      if (result.type === 'changeSet') {
        applyChangeSet(result);

        if (handleFdv1Fallback(result)) {
          // FDv1 fallback triggered during initialization — data was received
          // but we should move to synchronizers where the FDv1 adapter will run.
          dataReceived = true;
          break;
        }

        if (result.payload.state) {
          // Got basis data with a selector — initialization is complete.
          markInitialized();
          return;
        }

        // Got data but no selector (e.g., cache). Record that data was
        // received and continue to the next initializer.
        dataReceived = true;
      } else if (result.type === 'status') {
        switch (result.state) {
          case 'interrupted':
          case 'terminal_error':
            logger?.warn(`Initializer failed: ${result.errorInfo?.message ?? 'unknown error'}`);
            reportStatusError(result);
            break;
          case 'shutdown':
            return;
          case 'goodbye':
            break;
          default:
            break;
        }

        handleFdv1Fallback(result);
      }
    }

    // All initializers exhausted.
    if (dataReceived) {
      markInitialized();
    }
  }

  async function runSynchronizers(): Promise<void> {
    while (!closed) {
      const synchronizer = sourceManager.getNextAvailableSynchronizerAndSetActive();
      if (synchronizer === undefined) {
        if (!initialized) {
          initReject?.(new Error('All data sources exhausted without receiving data.'));
          initResolve = undefined;
          initReject = undefined;
        }
        return;
      }

      const conditions: ConditionGroup = getConditions(
        sourceManager.getAvailableSynchronizerCount(),
        sourceManager.isPrimeSynchronizer(),
        fallbackTimeoutMs,
        recoveryTimeoutMs,
      );

      // try/finally ensures conditions are closed on all code paths.
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

          const winner = await Promise.race(racers);
          if (closed) {
            return;
          }

          if (winner.source === 'condition') {
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
              if (!initialized) {
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
                  return;
                case 'goodbye':
                  // The synchronizer will handle reconnection internally.
                  break;
                default:
                  break;
              }
            }

            // Check for FDv1 fallback after all result handling — single location.
            if (handleFdv1Fallback(syncResult)) {
              synchronizerRunning = false;
            }
          }
        }
      } finally {
        conditions.close();
      }
    }
  }

  /* eslint-enable no-await-in-loop */

  async function runOrchestration(): Promise<void> {
    // No sources configured at all — nothing to wait for, immediately valid.
    if (initializerFactories.length === 0 && synchronizerSlots.length === 0) {
      statusManager.requestStateUpdate('VALID');
      markInitialized();
      return;
    }

    await runInitializers();
    if (!closed) {
      await runSynchronizers();
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
      sourceManager.close();
    },
  };
}
