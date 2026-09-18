/**
 * A single elapsed-time deadline for returning to the FDv2 data sources after
 * the server directed the SDK onto its FDv1 fallback synchronizer.
 *
 * The orchestration loop races {@link FDv2RecoveryTimer.promise} alongside the
 * active synchronizer, so the deadline is honored no matter which synchronizer
 * is running and no matter how many slots are currently available. Unlike the
 * heuristic fallback and recovery conditions, this deadline is unconditional:
 * only the elapsed time governs the return to FDv2.
 */
export interface FDv2RecoveryTimer {
  /**
   * Resolves when the scheduled deadline elapses, and stays resolved until
   * {@link FDv2RecoveryTimer.clear} is called, so an elapse that happens while
   * nobody is waiting is not lost. `undefined` when no deadline is pending.
   * A promise captured before a later {@link clear} or {@link schedule} call
   * never settles, so a `Promise.race` consumer must re-read this getter on
   * each iteration rather than holding onto an old reference.
   */
  readonly promise: Promise<void> | undefined;

  /**
   * Schedule the deadline. Supersedes any pending deadline: the newest
   * directive's TTL is the one that counts. No-op once closed.
   *
   * @param ttlMs Time to wait, in milliseconds.
   */
  schedule(ttlMs: number): void;

  /**
   * Cancel a pending deadline, or discard one that has already fired and been
   * acted on. Leaves the timer usable for a later {@link schedule} call.
   */
  clear(): void;

  /** Cancel any pending deadline and refuse further scheduling. */
  close(): void;
}

/**
 * Creates an {@link FDv2RecoveryTimer}.
 */
export function createFDv2RecoveryTimer(): FDv2RecoveryTimer {
  let handle: ReturnType<typeof setTimeout> | undefined;
  let pending: Promise<void> | undefined;
  let closed = false;

  function cancel() {
    if (handle !== undefined) {
      clearTimeout(handle);
      handle = undefined;
    }
    pending = undefined;
  }

  return {
    get promise(): Promise<void> | undefined {
      return pending;
    },

    schedule(ttlMs: number): void {
      if (closed) {
        return;
      }
      cancel();
      pending = new Promise<void>((resolve) => {
        handle = setTimeout(() => {
          // The promise is intentionally left in place after firing; the loop
          // discards it with clear() once it has acted on the deadline.
          handle = undefined;
          resolve();
        }, ttlMs);
      });
    },

    clear(): void {
      cancel();
    },

    close(): void {
      closed = true;
      cancel();
    },
  };
}
