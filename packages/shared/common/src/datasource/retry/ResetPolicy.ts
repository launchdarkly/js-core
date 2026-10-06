import { monotonicNow } from '../../utils';

/**
 * Decides when a component has operated well enough, for long enough, that its
 * retry state should reset.
 */
export interface ResetPolicy {
  /**
   * Records that the component is operating normally.
   */
  noteHealthy(): void;

  /**
   * Records a failure, which ends any healthy stretch in progress.
   */
  noteFailure(): void;

  /**
   * Reports whether the reset condition is met.
   */
  isSatisfied(): boolean;
}

/**
 * Creates a policy that resets once the component has operated without failing
 * for the given duration. Repeated healthy reports do not move the starting
 * point; only a failure clears it.
 *
 * @param healthyForMs How long the component must operate without failing,
 * in milliseconds; must be a positive, finite number.
 * @param clock The time source used to measure the healthy stretch; defaults
 * to a monotonic clock. Primarily for testing.
 */
export function createAfterHealthyFor(
  healthyForMs: number,
  clock: () => number = monotonicNow,
): ResetPolicy {
  let healthySinceMs: number | undefined;

  return {
    noteHealthy(): void {
      if (healthySinceMs === undefined) {
        healthySinceMs = clock();
      }
    },

    noteFailure(): void {
      healthySinceMs = undefined;
    },

    isSatisfied(): boolean {
      return healthySinceMs !== undefined && clock() - healthySinceMs >= healthyForMs;
    },
  };
}

/**
 * Creates a policy that resets once the given number of operations in a row
 * have succeeded.
 *
 * @param count How many operations in a row must succeed; must be a positive
 * integer.
 */
export function createAfterConsecutiveSuccesses(count: number): ResetPolicy {
  let successes = 0;

  return {
    noteHealthy(): void {
      successes += 1;
    },

    noteFailure(): void {
      successes = 0;
    },

    isSatisfied(): boolean {
      return successes >= count;
    },
  };
}
