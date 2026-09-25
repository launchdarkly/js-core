import { Backoff, DefaultBackoff, internal, LDLogger } from '@launchdarkly/js-sdk-common';

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

// Initial delay of the write-back retry backoff. The backoff doubles it per
// consecutive failure, with jitter, up to its own 30 second cap.
const WRITE_BACK_INITIAL_BACKOFF_MS = 1000;

// How long the store must stay healthy before the backoff resets. A store that
// flaps faster than this keeps its escalated backoff.
const WRITE_BACK_BACKOFF_RESET_MS = 30000;

// Delay after a successful write-back. Limits a flapping store to about one
// write-back per second instead of one per successful mirrored write.
const WRITE_BACK_SUCCESS_EMBARGO_MS = 1000;

// Deadline for a write-back or availability probe to answer. Past this, treat it as
// abandoned so a persistence client that never calls back cannot block recovery.
const HUNG_TIMEOUT_MS = 30000;

// True when a value looks like a Promise.
// Some persistence store implementations declare a callback but are actually async.
function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
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

// Wraps a callback so only its first call has an effect and NOOP the later calls.
function once(fn: (err?: Error) => void): (err?: Error) => void {
  let settled = false;
  return (err?: Error) => {
    if (settled) {
      return;
    }
    settled = true;
    fn(err);
  };
}

// The failure channel of a persistence store call: a rejected promise from a store
// that is actually async, or a synchronous throw.
type StoreCallFailure = 'rejection' | 'sync-throw';

// Invokes a persistence store operation and contains both failure channels.
// The store reports its result through the callback that `call` gives to it. A store
// may declare a callback but actually be async. This helper catches that rejection so
// it cannot surface as an unhandled rejection and crash the process. It also catches a
// synchronous throw so it cannot escape the call site.
function invokeStoreCall(
  call: () => unknown,
  onFailure: (err: Error, channel: StoreCallFailure) => void,
): void {
  try {
    const result = call();
    if (isPromiseLike(result)) {
      result.then(undefined, (reason: unknown) => onFailure(toError(reason), 'rejection'));
    }
  } catch (reason) {
    onFailure(toError(reason), 'sync-throw');
  }
}

/**
 * Tracks one kind of in-flight persistence store operation.
 *
 * At most one attempt is outstanding at a time. Every attempt gets a generation,
 * and an answer is honored only while its generation is current, so a stale or
 * duplicate answer from an earlier attempt can never be mistaken for the current
 * one. An attempt that never answers can be released once it is past a deadline.
 */
class SupervisedOperation {
  private _inFlight = false;
  private _generation = 0;
  private _startedAt = 0;

  get inFlight(): boolean {
    return this._inFlight;
  }

  /** Starts a new attempt and returns its generation. */
  begin(): number {
    this._generation += 1;
    this._inFlight = true;
    this._startedAt = Date.now();
    return this._generation;
  }

  /**
   * Records the answer of the given attempt. Returns false for a stale or
   * duplicate answer, which the caller must ignore.
   */
  settle(generation: number): boolean {
    if (!this.isCurrent(generation)) {
      return false;
    }
    this._inFlight = false;
    return true;
  }

  /** True while the given attempt is the outstanding one. */
  isCurrent(generation: number): boolean {
    return generation === this._generation && this._inFlight;
  }

  /** Invalidates the outstanding attempt, so a late answer is ignored. */
  invalidate(): void {
    this._generation += 1;
    this._inFlight = false;
  }

  /**
   * Invalidates the outstanding attempt once it is past its deadline. Returns
   * whether it was released.
   */
  releaseIfHung(timeoutMs: number): boolean {
    if (Date.now() - this._startedAt < timeoutMs) {
      return false;
    }
    this.invalidate();
    return true;
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

  // The poller's availability probe. In-flight only while a poll tick's probe is
  // outstanding, so a hung probe cannot block write-signal-triggered recovery.
  private _probe = new SupervisedOperation();

  // The full-data-set write-back. In-flight across both the probe-triggered and
  // write-signal-triggered recovery paths, so at most one write-back runs at a
  // time.
  private _writeBackOp = new SupervisedOperation();

  // Epoch ms before which a new write-back attempt is not issued. Persists across
  // flapping available/unavailable cycles instead of resetting on each transition,
  // so a fast-flapping store cannot dodge the backoff. Recovery replaces it with
  // the short success embargo in _markAvailable.
  private _writeBackEmbargoUntil = 0;

  // True when a mirrored write failed while a write-back was in flight. That
  // write-back's snapshot predates the failed item, so its success alone must not
  // mark the store recovered.
  private _writeFailedDuringWriteBack = false;

  // True once the current outage has logged a write-back failure at error level. A
  // hung write-back that gets released by its deadline advances the backoff but
  // never logs, so this flag tracks the log separately and keeps the outage's
  // first genuine failure at error level.
  private _failureLoggedThisOutage = false;

  private _closed = false;

  private _pollHandle?: ReturnType<typeof setInterval>;

  // One-shot timer for a store without an availability check. It re-runs, at the
  // embargo deadline, a recovery signal that arrived during the embargo. Such a
  // store has no poller, so a dropped signal would leave no later trigger.
  private _embargoRetryHandle?: ReturnType<typeof setTimeout>;

  // One-shot deadline for an in-flight write-back on a store without an
  // availability check. Such a store has no poller, so nothing else would notice
  // the write-back hanging.
  private _writeBackDeadlineHandle?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly _basePersistenceStore: LDFeatureStore,
    private readonly _logger?: LDLogger,
    // Injectable so tests can remove the jitter.
    private readonly _backoff: Backoff = new DefaultBackoff(
      WRITE_BACK_INITIAL_BACKOFF_MS,
      WRITE_BACK_BACKOFF_RESET_MS,
    ),
  ) {
    // The persistence store starts as the active store. It may already hold data
    // from a previous run, so reads go there until a basis write arrives.
    this._activeStore = this._basePersistenceStore;
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
          // basis causes memory store to become the active store
          this._activeStore = this._memoryStore;

          // A persistence failure must not fail the change. The memory store already
          // holds the data, so the change's own callback must still fire.
          const settleOnce = once((err?: Error) => {
            this._handleWriteResult(err, true);
            callback();
          });
          invokeStoreCall(() => this._basePersistenceStore.init(data, settleOnce), settleOnce);
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
                      const settleOnce = once((err?: Error) => {
                        this._handleWriteResult(err, false);
                        resolve();
                      });
                      invokeStoreCall(
                        () =>
                          this._basePersistenceStore.upsert(
                            nextParams.dataKind,
                            nextParams.item,
                            settleOnce,
                          ),
                        settleOnce,
                      );
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
    this._cancelEmbargoRetry();
    this._cancelWriteBackDeadline();
    this._basePersistenceStore.close();
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
      if (this._writeBackOp.inFlight) {
        this._writeFailedDuringWriteBack = true;
      }
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
    // Invalidate outstanding probe and write-back callbacks from before this outage.
    this._probe.invalidate();
    this._writeBackOp.invalidate();
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
    // The store just proved it is healthy. Reset the backoff and the log edge, so
    // this outage's failures do not carry into the next one.
    this._backoff.success();
    this._failureLoggedThisOutage = false;
    this._writeFailedDuringWriteBack = false;
    // Invalidate outstanding probe and write-back callbacks from this outage, so a
    // stale answer cannot flip state out from under the next outage.
    this._probe.invalidate();
    this._writeBackOp.invalidate();
    // Rate-limit the next write-back, so a flapping store triggers about one
    // write-back per second at most. This also replaces any longer failure
    // backoff: recovery just proved the store is healthy.
    this._writeBackEmbargoUntil = Date.now() + WRITE_BACK_SUCCESS_EMBARGO_MS;
    this._stopRecoveryPolling();
    this._cancelEmbargoRetry();
    this._cancelWriteBackDeadline();
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
    if (typeof this._basePersistenceStore.isStoreAvailable !== 'function') {
      return;
    }
    this._pollHandle = setInterval(() => {
      if (this._writeBackOp.inFlight) {
        if (!this._releaseWriteBackIfHung()) {
          // Still within the deadline. Wait for it to answer before probing again.
          return;
        }
      }
      if (this._probe.inFlight) {
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
      const probe = this._basePersistenceStore.isStoreAvailable?.bind(this._basePersistenceStore);
      if (!probe) {
        return;
      }
      const generation = this._probe.begin();
      const onAnswer = (isAvailable: boolean) => {
        // Ignore a stale or duplicate answer from a superseded probe.
        if (!this._probe.settle(generation)) {
          return;
        }
        if (this._closed) {
          return;
        }
        if (isAvailable) {
          this._attemptRecovery();
        }
      };
      // A probe that fails through either channel is treated as an unavailable
      // answer. It is not a write-back failure, so it does not affect the error log
      // or backoff.
      invokeStoreCall(
        () => probe(onAnswer),
        (err, channel) => {
          // A synchronous throw happens in the same stack frame that began the
          // probe, so its settle is always current. A rejection can arrive late,
          // and settle rejects it when a newer probe or an availability
          // transition superseded this one.
          if (!this._probe.settle(generation)) {
            return;
          }
          if (channel === 'sync-throw') {
            this._logger?.debug(`Persistent store availability check failed: ${err}`);
            return;
          }
          if (this._closed) {
            return;
          }
          this._logger?.debug(`Persistent store availability check rejected: ${err}`);
        },
      );
    }, RECOVERY_POLL_INTERVAL_MS);
  }

  private _stopRecoveryPolling(): void {
    if (this._pollHandle) {
      clearInterval(this._pollHandle);
      this._pollHandle = undefined;
    }
  }

  /**
   * Schedules, for a store without an availability check, the next write-back
   * attempt at the embargo deadline.
   *
   * Such a store has no poller. Without this timer, a recovery signal that arrived
   * during the embargo, or a failed write-back with no follow-up write, would leave
   * no later trigger, and the persistence store would stay stale until the next
   * mirrored write. At most one timer runs. Recovery and close cancel it.
   */
  private _scheduleEmbargoRetry(): void {
    if (this._pollHandle || this._embargoRetryHandle || this._closed) {
      return;
    }
    this._embargoRetryHandle = setTimeout(
      () => {
        this._embargoRetryHandle = undefined;
        this._attemptRecovery();
      },
      Math.max(this._writeBackEmbargoUntil - Date.now(), 0),
    );
  }

  private _cancelEmbargoRetry(): void {
    if (this._embargoRetryHandle) {
      clearTimeout(this._embargoRetryHandle);
      this._embargoRetryHandle = undefined;
    }
  }

  /**
   * Arms, for a store without an availability check, a one-shot deadline that
   * releases the write-back issued under the given generation if it is still in
   * flight when the deadline passes. Stores with a check are covered by the
   * poller's own tick instead.
   */
  private _armWriteBackDeadline(generation: number): void {
    if (typeof this._basePersistenceStore.isStoreAvailable === 'function' || this._closed) {
      return;
    }
    this._cancelWriteBackDeadline();
    this._writeBackDeadlineHandle = setTimeout(() => {
      this._writeBackDeadlineHandle = undefined;
      if (!this._writeBackOp.isCurrent(generation)) {
        return;
      }
      this._releaseWriteBackIfHung();
    }, HUNG_TIMEOUT_MS);
  }

  private _cancelWriteBackDeadline(): void {
    if (this._writeBackDeadlineHandle) {
      clearTimeout(this._writeBackDeadlineHandle);
      this._writeBackDeadlineHandle = undefined;
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
    if (!this._writeBackOp.releaseIfHung(HUNG_TIMEOUT_MS)) {
      return false;
    }
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
    if (!this._probe.releaseIfHung(HUNG_TIMEOUT_MS)) {
      return false;
    }
    this._logger?.debug(
      'A persistent store availability check did not complete in time. Retrying.',
    );
    return true;
  }

  private _attemptRecovery(): void {
    if (this._writeBackOp.inFlight && !this._releaseWriteBackIfHung()) {
      return;
    }
    if (this._persistenceAvailable) {
      return;
    }
    if (Date.now() < this._writeBackEmbargoUntil) {
      // Backing off after a write-back failure. A write-signal or probe answer that
      // arrives inside the embargo must not flood the persistence store with retries.
      // A store with a poller retries on a later poll tick. A store without one
      // must keep the signal, or it would have no later trigger.
      this._scheduleEmbargoRetry();
      return;
    }
    const generation = this._writeBackOp.begin();
    this._armWriteBackDeadline(generation);
    this._writeBack(generation);
  }

  /**
   * Write the full in-memory data set, including tombstones, to the persistence store.
   * The caller must begin the attempt on _writeBackOp and pass its generation.
   */
  private _writeBack(generation: number): void {
    if (this._closed) {
      this._writeBackOp.settle(generation);
      return;
    }
    if (this._activeStore !== this._memoryStore) {
      // No basis has been received, so there is no full data set to write. The next
      // basis fully populates the persistence store. _markAvailable() below already
      // invalidates this attempt.
      this._markAvailable();
      return;
    }
    // This attempt's snapshot is taken below, so a mirrored write can only fail
    // after it. Track those failures against this attempt from a clean slate.
    this._writeFailedDuringWriteBack = false;
    const onSettled = (err?: Error) => {
      // Ignore a late callback from an abandoned (timed-out) write-back.
      // It must not flip state out from under a newer one.
      if (!this._writeBackOp.settle(generation)) {
        return;
      }
      this._cancelWriteBackDeadline();
      if (this._closed) {
        return;
      }
      if (err) {
        this._handleWriteBackFailure();
        return;
      }
      if (this._writeFailedDuringWriteBack) {
        // A mirrored write failed while this write-back was in flight, so this
        // snapshot predates that item. Stay unavailable and run another write-back
        // with the current data once the flap embargo passes.
        this._writeBackEmbargoUntil = Date.now() + WRITE_BACK_SUCCESS_EMBARGO_MS;
        this._attemptRecovery();
        return;
      }
      this._markAvailable();
    };
    // A rejected promise, or a synchronous throw from init() or getAllRaw(), is
    // handled the same way as a failed write-back. This way it cannot escape the
    // poll timer or the write path.
    invokeStoreCall(
      () => this._basePersistenceStore.init(this._memoryStore.getAllRaw(), onSettled),
      onSettled,
    );
  }

  /**
   * Backs off the next write-back attempt after a failed or abandoned one, and, for
   * a store without a poller, schedules that attempt at the backoff deadline.
   */
  private _armFailureEmbargo(): void {
    this._writeBackEmbargoUntil = Date.now() + this._backoff.fail();
    this._scheduleEmbargoRetry();
  }

  /**
   * Records a failed write-back attempt: backs off the next attempt and logs.
   *
   * Only the first failure of an outage logs at error level. Later failures in the
   * same outage log at debug level, so an unhealthy store cannot flood the log
   * every poll tick.
   */
  private _handleWriteBackFailure(): void {
    if (this._persistenceAvailable) {
      // Defense against a stale write-back from an already-recovered outage.
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
