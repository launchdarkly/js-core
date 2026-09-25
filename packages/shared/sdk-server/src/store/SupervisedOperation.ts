/**
 * Tracks one kind of in-flight asynchronous operation.
 *
 * At most one attempt is outstanding at a time. Every attempt gets a generation,
 * and an answer is honored only while its generation is current, so a stale or
 * duplicate answer from an earlier attempt can never be mistaken for the current
 * one. An attempt that never answers can be released once it is past a deadline.
 */
export default class SupervisedOperation {
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
