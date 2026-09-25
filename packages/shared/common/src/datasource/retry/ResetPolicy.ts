function defaultClock(): () => number {
  const perf = (globalThis as any)?.performance;
  if (perf && typeof perf.now === 'function') {
    return () => perf.now();
  }
  return () => Date.now();
}

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
 * Resets once the component has operated without failing for the given
 * duration. Repeated healthy reports do not move the starting point; only a
 * failure clears it.
 */
export class AfterHealthyFor implements ResetPolicy {
  private _healthySinceMs?: number;
  private readonly _clock: () => number;

  /**
   * @param _healthyForMs How long the component must operate without failing,
   * in milliseconds.
   * @param clock The time source used to measure the healthy stretch; defaults
   * to a monotonic clock. Primarily for testing.
   */
  constructor(
    private readonly _healthyForMs: number,
    clock?: () => number,
  ) {
    this._clock = clock ?? defaultClock();
  }

  noteHealthy(): void {
    if (this._healthySinceMs === undefined) {
      this._healthySinceMs = this._clock();
    }
  }

  noteFailure(): void {
    this._healthySinceMs = undefined;
  }

  isSatisfied(): boolean {
    return (
      this._healthySinceMs !== undefined &&
      this._clock() - this._healthySinceMs >= this._healthyForMs
    );
  }
}

/**
 * Resets once the given number of operations in a row have succeeded.
 */
export class AfterConsecutiveSuccesses implements ResetPolicy {
  private _successes = 0;

  constructor(private readonly _count: number) {}

  noteHealthy(): void {
    this._successes += 1;
  }

  noteFailure(): void {
    this._successes = 0;
  }

  isSatisfied(): boolean {
    return this._successes >= this._count;
  }
}
