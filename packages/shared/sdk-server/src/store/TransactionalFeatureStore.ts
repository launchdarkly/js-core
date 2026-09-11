import { internal, LDLogger } from '@launchdarkly/js-sdk-common';

import { DataKind } from '../api/interfaces';
import {
  LDFeatureStore,
  LDFeatureStoreDataStorage,
  LDFeatureStoreItem,
  LDFeatureStoreKindData,
  LDKeyedFeatureStoreItem,
  LDTransactionalFeatureStore,
} from '../api/subsystems';
import InMemoryFeatureStore from './InMemoryFeatureStore';

// How often to check the persistence store for recovery while it is unavailable.
const RECOVERY_POLL_INTERVAL_MS = 500;

// Ceiling on the exponential backoff between write-back attempts, in wall-clock ms.
const MAX_WRITE_BACK_BACKOFF_MS = 30000;

// Delay after a successful write-back. Limits a flapping store to about one
// write-back per second instead of one per successful mirrored write.
const WRITE_BACK_SUCCESS_EMBARGO_MS = 1000;

// Deadline for a write-back or availability probe to answer. Past this, treat it as
// abandoned so a persistence client that never calls back cannot block recovery.
const HUNG_TIMEOUT_MS = 30000;

// True when a value looks like a Promise.
// Some persistence store implementations declare a callback but are actually async. If
// their promise rejects before the callback runs, this handles it here so it cannot
// surface as an unhandled rejection and crash the process.
function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}

function toError(reason: unknown): Error {
  if (reason instanceof Error) {
    return reason;
  }
  try {
    return new Error(String(reason));
  } catch {
    // The reason cannot be converted to a string, for example a null-prototype object
    // or a value whose toString() throws. Fall back to a fixed message rather than
    // let this conversion itself become a second, unhandled failure.
    return new Error(
      'Persistent store operation failed with a reason that could not be described.',
    );
  }
}

/**
 * Wraps a non-transactional {@link LDFeatureStore} and makes it transactional through
 * an in-memory store acting as a cache.
 *
 * It also monitors the mirrored writes to the persistence store. A failed write marks
 * the store unavailable. When the store recovers, this writes the full in-memory data
 * set back to it.
 *
 * Persistence stores that do not serialize writes internally may see overlapping
 * full-store writes after an abandoned write-back.
 */
export default class TransactionalFeatureStore implements LDTransactionalFeatureStore {
  private _memoryStore: InMemoryFeatureStore;
  private _activeStore: LDFeatureStore;

  // The persistence store is considered available until a write reports an error.
  private _persistenceAvailable = true;

  // True while a poll tick's availability probe is outstanding. Guards only the
  // poller, so a hung probe cannot block write-signal-triggered recovery.
  private _probeInFlight = false;

  // Bumped on every new probe and on every availability transition. A probe answer
  // is honored only when its generation still matches, so a stale or duplicate
  // answer from an earlier probe can never be mistaken for the current one.
  private _probeGeneration = 0;

  // Date.now() when the outstanding probe was issued. Detects a probe whose callback
  // never fires.
  private _probeStartedAt = 0;

  // True while a write-back attempt is outstanding. Guards both the probe-triggered
  // and write-signal-triggered recovery paths, so at most one write-back runs at a
  // time.
  private _writeBackInFlight = false;

  // Bumped on every new write-back and when a hung one is abandoned. Same role as
  // _probeGeneration, for write-back callbacks.
  private _writeBackGeneration = 0;

  // Date.now() when the outstanding write-back was issued. Detects a write-back
  // whose callback never fires.
  private _writeBackStartedAt = 0;

  // Consecutive write-back failures in the current outage, including hung
  // write-backs abandoned at their deadline. Drives the retry backoff. Reset only on
  // recovery, since that is the only proof the store is healthy again.
  private _consecutiveWriteBackFailures = 0;

  // Epoch ms before which a new write-back attempt is not issued. Persists across
  // flapping available/unavailable cycles instead of resetting on each transition,
  // so a fast-flapping store cannot dodge the backoff. Recovery only lowers it,
  // capping it to the success embargo floor in _markAvailable.
  private _writeBackEmbargoUntil = 0;

  // True once the current outage has logged a write-back failure at error level. A
  // hung write-back that gets released by its deadline also counts toward
  // _consecutiveWriteBackFailures but never logs, so this flag tracks the log
  // separately and keeps the outage's first genuine failure at error level.
  private _failureLoggedThisOutage = false;

  private _closed = false;

  private _pollHandle?: ReturnType<typeof setInterval>;

  constructor(
    private readonly _nonTransPersistenceStore: LDFeatureStore,
    private readonly _logger?: LDLogger,
  ) {
    // The persistence store starts as the active store. It may already hold data
    // from a previous run, so reads go there until a basis write arrives.
    this._activeStore = this._nonTransPersistenceStore;
    this._memoryStore = new InMemoryFeatureStore();
  }

  get(kind: DataKind, key: string, callback: (res: LDFeatureStoreItem | null) => void): void {
    this._activeStore.get(kind, key, callback);
  }

  all(kind: DataKind, callback: (res: LDFeatureStoreKindData) => void): void {
    this._activeStore.all(kind, callback);
  }

  init(allData: LDFeatureStoreDataStorage, callback: () => void): void {
    // adapt to applyChanges for common handling
    this.applyChanges(true, allData, callback);
  }

  delete(kind: DataKind, key: string, version: number, callback: () => void): void {
    // adapt to applyChanges for common handling
    const item: LDKeyedFeatureStoreItem = { key, version, deleted: true };
    this.applyChanges(
      false,
      {
        [kind.namespace]: {
          [key]: item,
        },
      },
      callback,
    );
  }

  upsert(kind: DataKind, data: LDKeyedFeatureStoreItem, callback: () => void): void {
    // adapt to applyChanges for common handling
    this.applyChanges(
      false,
      {
        [kind.namespace]: {
          [data.key]: data,
        },
      },
      callback,
    );
  }

  applyChanges(
    basis: boolean,
    data: LDFeatureStoreDataStorage,
    callback: () => void,
    initMetadata?: internal.InitMetadata,
    selector?: string,
  ): void {
    this._memoryStore.applyChanges(
      basis,
      data,
      () => {
        // TODO: SDK-1047 conditional propgation to persistence based on parameter
        if (basis) {
          // Only a basis carries the full data set, so only a basis switches reads
          // over to the memory store.
          this._activeStore = this._memoryStore;

          // Settles exactly once no matter how the store answers: callback, a rejected
          // promise if it is actually async, or a synchronous throw. Whichever fires
          // first wins.
          //
          // A persistence failure must not fail the change. The memory store already
          // holds the data, so the change's own callback must still fire.
          let settled = false;
          const settleOnce = (err?: Error) => {
            if (settled) {
              return;
            }
            settled = true;
            this._handleWriteResult(err, true);
            callback();
          };
          try {
            const result = this._nonTransPersistenceStore.init(data, settleOnce);
            if (isThenable(result)) {
              result.then(undefined, (err: unknown) => settleOnce(toError(err)));
            }
          } catch (err) {
            settleOnce(toError(err));
          }
        } else {
          const params: { dataKind: DataKind; item: LDKeyedFeatureStoreItem }[] = [];
          Object.entries(data).forEach(([namespace, items]) => {
            Object.keys(items || {}).forEach((key) => {
              params.push({ dataKind: { namespace }, item: { key, ...items[key] } });
            });
          });

          params
            .reduce(
              (previousPromise, nextParams) =>
                previousPromise.then(
                  () =>
                    new Promise<void>((resolve) => {
                      // Same once-only containment as the basis write above, applied
                      // per mirrored item.
                      let settled = false;
                      const settleOnce = (err?: Error) => {
                        if (settled) {
                          return;
                        }
                        settled = true;
                        this._handleWriteResult(err, false);
                        resolve();
                      };
                      try {
                        const result = this._nonTransPersistenceStore.upsert(
                          nextParams.dataKind,
                          nextParams.item,
                          settleOnce,
                        );
                        if (isThenable(result)) {
                          result.then(undefined, (err: unknown) => settleOnce(toError(err)));
                        }
                      } catch (err) {
                        settleOnce(toError(err));
                      }
                    }),
                ),
              Promise.resolve(),
            )
            // Defensive: settleOnce never rejects the chain, so this should be
            // unreachable. If it ever runs, the change's callback must still fire.
            .catch(() => {})
            .then(callback);
        }
      },
      initMetadata,
      selector,
    );
  }

  initialized(callback: (isInitialized: boolean) => void): void {
    // Delegating here is safe: _activeStore only switches to the memory store after
    // the memory store has already been initialized.
    this._activeStore.initialized(callback);
  }

  close(): void {
    if (this._closed) {
      return;
    }
    this._closed = true;
    this._stopRecoveryPolling();
    this._nonTransPersistenceStore.close();
    this._memoryStore.close();
  }

  getDescription(): string {
    return 'transactional persistent store';
  }

  // applyChanges always writes to the memory store first, so it always has the
  // latest metadata and selector, even while _activeStore still points at the
  // persistence store. The plain LDFeatureStore contract has no way to read them
  // from there.
  getInitMetaData(): internal.InitMetadata | undefined {
    return this._memoryStore.getInitMetaData?.();
  }

  getSelector(): string | undefined {
    return this._memoryStore.getSelector?.();
  }

  /**
   * Record the result of a mirrored write to the persistence store.
   *
   * The first failed write marks the store unavailable. A successful write while the
   * store is unavailable starts recovery.
   *
   * A basis write already wrote the full data set, so it recovers directly. Any
   * other write starts a write-back of the full in-memory data set instead.
   */
  private _handleWriteResult(err: Error | undefined, isBasisWrite: boolean): void {
    if (this._closed) {
      return;
    }
    if (err) {
      this._markUnavailable();
    } else if (!this._persistenceAvailable) {
      if (isBasisWrite) {
        // Already wrote the full data set as the basis; a write-back would repeat it.
        this._markAvailable();
      } else {
        this._attemptRecovery();
      }
    }
  }

  private _markUnavailable(): void {
    if (!this._persistenceAvailable) {
      return;
    }
    this._persistenceAvailable = false;
    // A stale probe from before this outage must never answer into it.
    this._probeGeneration += 1;
    this._probeInFlight = false;
    // No write-back can be in flight here, since a write-back only starts once the
    // store is already unavailable. This bump is a no-op today, kept only for
    // symmetry with the probe reset above. The guard that matters lives in
    // _markAvailable() below.
    this._writeBackGeneration += 1;
    this._writeBackInFlight = false;
    this._failureLoggedThisOutage = false;
    this._logger?.warn(
      'Persistent store is unavailable. Updates will be kept in memory until it recovers.',
    );
    this._startRecoveryPolling();
  }

  private _markAvailable(): void {
    if (this._persistenceAvailable) {
      return;
    }
    this._persistenceAvailable = true;
    // The store just proved it is healthy.
    // Failures left over from this outage must not carry into the next one, or
    // suppress its first error log.
    this._consecutiveWriteBackFailures = 0;
    this._failureLoggedThisOutage = false;
    // A stale probe answer from this outage must never fire a redundant write-back.
    this._probeGeneration += 1;
    this._probeInFlight = false;
    // A stale write-back from this outage must never be honored after recovery, or
    // flip state out from under the next outage.
    this._writeBackGeneration += 1;
    this._writeBackInFlight = false;
    // A failure embargo built up during this outage must not delay the next
    // outage's first write-back attempt. Recovery just proved the store is healthy.
    // The success floor below already covers flap damping.
    this._writeBackEmbargoUntil = Math.min(
      this._writeBackEmbargoUntil,
      Date.now() + WRITE_BACK_SUCCESS_EMBARGO_MS,
    );
    this._stopRecoveryPolling();
    this._logger?.info('Persistent store is available again.');
  }

  /**
   * Poll the persistence store availability check, when it has one, until the store
   * recovers. Stores without an availability check recover through the next successful
   * mirrored write instead. The check is read-only. A write is never used as a check.
   */
  private _startRecoveryPolling(): void {
    if (this._pollHandle || this._closed) {
      return;
    }
    if (typeof this._nonTransPersistenceStore.isStoreAvailable !== 'function') {
      return;
    }
    this._pollHandle = setInterval(() => {
      if (this._writeBackInFlight) {
        if (!this._releaseWriteBackIfHung()) {
          // Still within the deadline. Wait for it to answer before probing again.
          return;
        }
      }
      if (this._probeInFlight) {
        if (!this._releaseProbeIfHung()) {
          // Still within the deadline. Wait for it to answer before probing again.
          return;
        }
      }
      if (this._persistenceAvailable) {
        return;
      }
      if (Date.now() < this._writeBackEmbargoUntil) {
        // Backing off after a write-back failure.
        return;
      }
      const probe = this._nonTransPersistenceStore.isStoreAvailable?.bind(
        this._nonTransPersistenceStore,
      );
      if (!probe) {
        return;
      }
      this._probeGeneration += 1;
      const generation = this._probeGeneration;
      this._probeInFlight = true;
      this._probeStartedAt = Date.now();
      const onAnswer = (isAvailable: boolean) => {
        // Ignore a stale or duplicate answer from a superseded probe.
        if (generation !== this._probeGeneration || !this._probeInFlight) {
          return;
        }
        this._probeInFlight = false;
        if (this._closed) {
          return;
        }
        if (isAvailable) {
          this._attemptRecovery();
        }
      };
      try {
        const result = probe(onAnswer);
        if (isThenable(result)) {
          result.then(undefined, (err: unknown) => {
            // A rejected probe promise is treated as an unavailable answer. It is
            // not a write-back failure, so it does not affect the error log or backoff.
            if (generation !== this._probeGeneration || !this._probeInFlight) {
              return;
            }
            this._probeInFlight = false;
            if (this._closed) {
              return;
            }
            this._logger?.debug(`Persistent store availability check rejected: ${toError(err)}`);
          });
        }
      } catch (err) {
        // A probe that throws synchronously is treated as an unavailable answer. It is
        // not a write-back failure, so it does not affect the error log or backoff.
        this._probeInFlight = false;
        this._logger?.debug(`Persistent store availability check threw: ${toError(err)}`);
      }
    }, RECOVERY_POLL_INTERVAL_MS);
  }

  private _stopRecoveryPolling(): void {
    if (this._pollHandle) {
      clearInterval(this._pollHandle);
      this._pollHandle = undefined;
    }
  }

  /**
   * Abandons the outstanding write-back once it is past its deadline.
   *
   * Bumps the generation so a late callback is ignored, and clears the in-flight
   * flag so a fresh attempt can proceed. Also arms the failure embargo, so a
   * persistence store that never answers backs off on the same schedule as a real
   * failure instead of retrying every poll tick. Returns whether it was released.
   */
  private _releaseWriteBackIfHung(): boolean {
    if (Date.now() - this._writeBackStartedAt < HUNG_TIMEOUT_MS) {
      return false;
    }
    this._writeBackGeneration += 1;
    this._writeBackInFlight = false;
    this._armFailureEmbargo();
    this._logger?.debug('A write-back to the persistent store did not complete in time. Retrying.');
    return true;
  }

  /**
   * Abandons the outstanding availability probe once it is past its deadline.
   *
   * Bumps the generation so a late answer is ignored, and clears the in-flight flag
   * so a fresh probe can be issued. Returns whether it was released.
   */
  private _releaseProbeIfHung(): boolean {
    if (Date.now() - this._probeStartedAt < HUNG_TIMEOUT_MS) {
      return false;
    }
    this._probeGeneration += 1;
    this._probeInFlight = false;
    this._logger?.debug(
      'A persistent store availability check did not complete in time. Retrying.',
    );
    return true;
  }

  private _attemptRecovery(): void {
    if (this._writeBackInFlight && !this._releaseWriteBackIfHung()) {
      return;
    }
    if (this._persistenceAvailable) {
      return;
    }
    if (Date.now() < this._writeBackEmbargoUntil) {
      // Backing off after a write-back failure. A write-signal or probe answer that
      // arrives inside the embargo must not flood the persistence store with retries.
      return;
    }
    this._writeBackGeneration += 1;
    const generation = this._writeBackGeneration;
    this._writeBackInFlight = true;
    this._writeBackStartedAt = Date.now();
    this._writeBack(generation);
  }

  /**
   * Write the full in-memory data set, including tombstones, to the persistence store.
   * The caller must set _writeBackInFlight and capture _writeBackGeneration before
   * calling this method.
   */
  private _writeBack(generation: number): void {
    if (this._closed) {
      this._writeBackInFlight = false;
      return;
    }
    if (this._activeStore !== this._memoryStore) {
      // No basis has been received, so there is no full data set to write. The next
      // basis fully populates the persistence store. _markAvailable() below already
      // clears _writeBackInFlight.
      this._markAvailable();
      return;
    }
    const onSettled = (err?: Error) => {
      // Ignore a late callback from an abandoned (timed-out) write-back.
      // It must not flip state out from under a newer one.
      if (generation !== this._writeBackGeneration || !this._writeBackInFlight) {
        return;
      }
      this._writeBackInFlight = false;
      if (this._closed) {
        return;
      }
      if (err) {
        this._handleWriteBackFailure();
        return;
      }
      this._handleWriteBackSuccess();
    };
    try {
      const result = this._nonTransPersistenceStore.init(this._memoryStore.getAllRaw(), onSettled);
      if (isThenable(result)) {
        result.then(undefined, (err: unknown) => onSettled(toError(err)));
      }
    } catch (err) {
      // A synchronous throw from init(), or from getAllRaw(), is handled the same way
      // as a failed write-back. This way it cannot escape the poll timer or the
      // write path.
      onSettled(toError(err));
    }
  }

  /**
   * Records a successful write-back.
   *
   * Clears the failure count and arms a short embargo, so a flapping store cannot
   * trigger more than about one write-back per second.
   */
  private _handleWriteBackSuccess(): void {
    this._writeBackEmbargoUntil = Date.now() + WRITE_BACK_SUCCESS_EMBARGO_MS;
    this._markAvailable();
  }

  /**
   * Increments the current outage's failure count.
   *
   * Sets the exponential backoff embargo that gates the next write-back attempt.
   */
  private _armFailureEmbargo(): void {
    this._consecutiveWriteBackFailures += 1;
    const backoffMs = Math.min(
      2 ** this._consecutiveWriteBackFailures * 500,
      MAX_WRITE_BACK_BACKOFF_MS,
    );
    this._writeBackEmbargoUntil = Date.now() + backoffMs;
  }

  /**
   * Records a failed write-back attempt: backs off the next attempt and logs.
   *
   * Only the first failure of an outage logs at error level. Later failures in the
   * same outage log at debug level, so an unhealthy store cannot flood the log
   * every poll tick. See _failureLoggedThisOutage for why this is tracked
   * separately from _consecutiveWriteBackFailures.
   */
  private _handleWriteBackFailure(): void {
    if (this._persistenceAvailable) {
      // A stale write-back from a prior, already-recovered outage.
      // The generation guard in _writeBack() should already have dropped this.
      // This check is a second, cheap defense against a spurious failure log while
      // the store is healthy.
      return;
    }
    this._armFailureEmbargo();
    const message =
      'Failed to write the in-memory data to the persistent store. The persistent store remains unavailable.';
    if (!this._failureLoggedThisOutage) {
      this._failureLoggedThisOutage = true;
      this._logger?.error(message);
    } else {
      this._logger?.debug(message);
    }
  }
}
