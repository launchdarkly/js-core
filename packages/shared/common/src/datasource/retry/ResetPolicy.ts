/**
 * Decides when a component has operated well enough, for long enough, that its
 * retry state should reset.
 */
export interface ResetPolicy {
  /**
   * Records that the component is operating normally.
   *
   * @param nowMs The current time, from the clock of the RetryState that owns
   * this policy.
   */
  noteHealthy(nowMs: number): void;

  /**
   * Records a failure, which ends any healthy stretch in progress.
   */
  noteFailure(): void;

  /**
   * Reports whether the reset condition is met.
   *
   * @param nowMs The current time, from the clock of the RetryState that owns
   * this policy.
   */
  isSatisfied(nowMs: number): boolean;
}

/**
 * Resets once the component has operated without failing for the given
 * duration. Repeated healthy reports do not move the starting point; only a
 * failure clears it.
 */
export class AfterHealthyFor implements ResetPolicy {
  private _healthySinceMs?: number;

  constructor(private readonly _healthyForMs: number) {}

  noteHealthy(nowMs: number): void {
    if (this._healthySinceMs === undefined) {
      this._healthySinceMs = nowMs;
    }
  }

  noteFailure(): void {
    this._healthySinceMs = undefined;
  }

  isSatisfied(nowMs: number): boolean {
    return this._healthySinceMs !== undefined && nowMs - this._healthySinceMs >= this._healthyForMs;
  }
}

/**
 * Resets once the given number of operations in a row have succeeded.
 */
export class AfterConsecutiveSuccesses implements ResetPolicy {
  private _successes = 0;

  constructor(private readonly _count: number) {}

  noteHealthy(_nowMs: number): void {
    this._successes += 1;
  }

  noteFailure(): void {
    this._successes = 0;
  }

  isSatisfied(_nowMs: number): boolean {
    return this._successes >= this._count;
  }
}
