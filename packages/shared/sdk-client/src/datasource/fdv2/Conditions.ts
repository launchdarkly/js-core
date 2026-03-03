import { cancelableTimedPromise } from '@launchdarkly/js-sdk-common';

import { FDv2SourceResult } from './FDv2SourceResult';

export const DEFAULT_FALLBACK_TIMEOUT_MS = 2 * 60 * 1000; // 120 seconds
export const DEFAULT_RECOVERY_TIMEOUT_MS = 5 * 60 * 1000; // 300 seconds

/**
 * A timer that resolves with a {@link ConditionType} when it fires.
 * If cancelled, the promise never settles.
 */
interface ConditionTimer {
  promise: Promise<ConditionType>;
  cancel: () => void;
}

/**
 * Creates a cancelable timer that resolves with the given {@link ConditionType}
 * when it fires. Wraps {@link cancelableTimedPromise} to convert its
 * reject-on-timeout semantics into resolve-with-type semantics.
 */
function conditionTimer(timeoutMs: number, type: ConditionType, taskName: string): ConditionTimer {
  const timed = cancelableTimedPromise(timeoutMs / 1000, taskName);
  return {
    promise: timed.promise.then(
      () => new Promise<ConditionType>(() => {}), // cancelled — never settle
      () => type, // timeout fired
    ),
    cancel: timed.cancel,
  };
}

/**
 * The type of condition that fired, determining the orchestrator's response.
 * - `'fallback'`: move to the next available synchronizer
 * - `'recovery'`: reset to the primary synchronizer
 */
export type ConditionType = 'fallback' | 'recovery';

/**
 * A timed condition that races against `synchronizer.next()`. When the
 * condition fires, it produces a {@link ConditionType} that the orchestration
 * loop uses to decide what to do.
 */
export interface Condition {
  /** Resolves when the condition fires. Created at construction time. */
  readonly promise: Promise<ConditionType>;

  /**
   * Inform the condition about a synchronizer result. Some conditions use
   * this to start or cancel their timers.
   */
  inform(result: FDv2SourceResult): void;

  /** Cancel any pending timers and clean up. */
  close(): void;
}

/**
 * A group of conditions managed together. The group races all conditions
 * and broadcasts results to all of them.
 */
export interface ConditionGroup {
  /** Race all conditions. `undefined` if no conditions exist. */
  readonly promise: Promise<ConditionType> | undefined;

  /** Broadcast a result to all conditions. */
  inform(result: FDv2SourceResult): void;

  /** Close all conditions. */
  close(): void;
}

/**
 * Creates a fallback condition. The condition starts a timer when an
 * `interrupted` status is received and cancels it when a `changeSet` is
 * received. If the timer fires, the condition resolves with `'fallback'`.
 *
 * @param timeoutMs Time in milliseconds before the condition fires.
 */
export function createFallbackCondition(timeoutMs: number): Condition {
  let resolve: ((type: ConditionType) => void) | undefined;
  let timer: ConditionTimer | undefined;
  let closed = false;

  const promise = new Promise<ConditionType>((res) => {
    resolve = res;
  });

  function cancelTimer() {
    timer?.cancel();
    timer = undefined;
  }

  return {
    promise,

    inform(result: FDv2SourceResult) {
      if (closed) {
        return;
      }

      if (result.type === 'changeSet') {
        cancelTimer();
        return;
      }

      if (result.type === 'status' && result.state === 'interrupted') {
        if (!timer) {
          timer = conditionTimer(timeoutMs, 'fallback', 'fallback condition');
          timer.promise.then((type) => {
            timer = undefined;
            resolve?.(type);
          });
        }
      }
    },

    close() {
      closed = true;
      cancelTimer();
    },
  };
}

/**
 * Creates a recovery condition. The condition starts a timer immediately
 * and resolves with `'recovery'` when it fires. It ignores all `inform()`
 * calls.
 *
 * @param timeoutMs Time in milliseconds before the condition fires.
 */
export function createRecoveryCondition(timeoutMs: number): Condition {
  const timer = conditionTimer(timeoutMs, 'recovery', 'recovery condition');

  return {
    promise: timer.promise,
    inform() {},
    close() {
      timer.cancel();
    },
  };
}

/**
 * Creates a group of conditions that are managed together.
 *
 * @param conditions The conditions to group.
 */
export function createConditionGroup(conditions: Condition[]): ConditionGroup {
  return {
    promise: conditions.length === 0 ? undefined : Promise.race(conditions.map((c) => c.promise)),

    inform(result: FDv2SourceResult) {
      conditions.forEach((condition) => condition.inform(result));
    },

    close() {
      conditions.forEach((condition) => condition.close());
    },
  };
}

/**
 * Determines which conditions to create based on the synchronizer's position
 * and availability.
 *
 * - If there is only one available synchronizer, no conditions are needed
 *   (there is nowhere to fall back to).
 * - If the current synchronizer is the primary (first available), only a
 *   fallback condition is created.
 * - If the current synchronizer is non-primary, both fallback and recovery
 *   conditions are created.
 *
 * @param availableSyncCount Number of available (non-blocked) synchronizers.
 * @param isPrime Whether the current synchronizer is the primary.
 * @param fallbackTimeoutMs Fallback condition timeout.
 * @param recoveryTimeoutMs Recovery condition timeout.
 */
export function getConditions(
  availableSyncCount: number,
  isPrime: boolean,
  fallbackTimeoutMs: number = DEFAULT_FALLBACK_TIMEOUT_MS,
  recoveryTimeoutMs: number = DEFAULT_RECOVERY_TIMEOUT_MS,
): ConditionGroup {
  if (availableSyncCount <= 1) {
    return createConditionGroup([]);
  }

  if (isPrime) {
    return createConditionGroup([createFallbackCondition(fallbackTimeoutMs)]);
  }

  return createConditionGroup([
    createFallbackCondition(fallbackTimeoutMs),
    createRecoveryCondition(recoveryTimeoutMs),
  ]);
}
