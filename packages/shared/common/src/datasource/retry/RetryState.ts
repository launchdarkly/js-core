import { LDLogger } from '../../api/logging/LDLogger';
import { FailureKind } from '../../errors';
import { AfterConsecutiveSuccesses, AfterHealthyFor, ResetPolicy } from './ResetPolicy';

// The delay bounds of the extended regime, in milliseconds. A component enters
// the extended regime after an unexpected failure and leaves it when its reset
// policy is satisfied.
const EXTENDED_INITIAL_DELAY_MS = 5 * 60 * 1000;
const EXTENDED_CEILING_MS = 60 * 60 * 1000;

// The bounds, reset window, and default initial delay of streaming's normal regime.
const STREAMING_NORMAL_CEILING_MS = 30 * 1000;
const STREAMING_RESET_INTERVAL_MS = 60 * 1000;
const DEFAULT_STREAMING_INITIAL_DELAY_MS = 1000;

// Polling's reset condition and default cadence.
const POLLING_RESET_SUCCESSES = 2;
const DEFAULT_POLL_INTERVAL_MS = 30 * 1000;

function positiveFiniteOrDefault(
  value: number,
  defaultValueMs: number,
  name: string,
  logger?: LDLogger,
): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }
  logger?.warn(
    `${name} must be a positive, finite number of milliseconds; using the default of ${defaultValueMs}`,
  );
  return defaultValueMs;
}

export interface RetryStateConfig {
  /** The delay before the first retry in the normal regime, in milliseconds. */
  normalInitialDelayMs: number;

  /** The longest normal-regime delay, in milliseconds. */
  normalCeilingMs: number;

  /** The delay before the first retry in the extended regime, in milliseconds. */
  extendedInitialDelayMs: number;

  /** The longest extended-regime delay, in milliseconds. */
  extendedCeilingMs: number;

  /** Decides when the retry state resets. */
  resetPolicy: ResetPolicy;

  /**
   * The wait between healthy operations, in milliseconds. No wait is ever
   * shorter than this. Zero (the default) for a component that operates
   * continuously.
   */
  operatingCadenceMs?: number;

  /** The random source used for jitter. */
  random?: () => number;
}

/**
 * Tracks how long a data source, or another long-running component, should
 * wait before its next attempt.
 *
 * Recording a failure advances the state and decides the next wait, which
 * {@link RetryState.nextDelay} reports: the delay doubles with each
 * consecutive failure, from the current regime's initial delay up to its
 * ceiling, less a random jitter of up to half of it, and never less than the
 * operating cadence. An unexpected failure moves the state to the extended
 * regime, which raises both bounds; a normal failure that follows cannot lower
 * them. The bounds stay raised until the reset policy is satisfied.
 *
 * Recording a success sets the next wait back to the operating cadence, even
 * while the retry state is raised, because a backoff wait applies to a retry
 * and not to every operation.
 *
 * This class never starts timers, performs I/O, or logs; callers schedule the
 * waits it computes. Use one instance per component; instances are never
 * shared between components.
 */
export class RetryState {
  private _attempts = 0;
  private _extended = false;
  private _minDelayMs: number;
  private _maxDelayMs: number;
  private _nextDelayMs: number;
  private _serverDirectedBaseMs?: number;
  private readonly _normalInitialDelayMs: number;
  private readonly _normalCeilingMs: number;
  private readonly _extendedInitialDelayMs: number;
  private readonly _extendedCeilingMs: number;
  private readonly _operatingCadenceMs: number;
  private readonly _resetPolicy: ResetPolicy;
  private readonly _random: () => number;

  constructor(config: RetryStateConfig) {
    this._normalInitialDelayMs = config.normalInitialDelayMs;
    this._normalCeilingMs = Math.max(config.normalCeilingMs, config.normalInitialDelayMs);
    this._extendedInitialDelayMs = config.extendedInitialDelayMs;
    this._extendedCeilingMs = Math.max(config.extendedCeilingMs, config.extendedInitialDelayMs);
    this._operatingCadenceMs = config.operatingCadenceMs ?? 0;
    this._resetPolicy = config.resetPolicy;
    this._random = config.random ?? Math.random;
    this._minDelayMs = this._normalInitialDelayMs;
    this._maxDelayMs = this._normalCeilingMs;
    // Before any outcome is recorded, the next wait is the ordinary interval.
    this._nextDelayMs = this._operatingCadenceMs;
  }

  /**
   * The wait, in milliseconds, before the next operation, as the last
   * recorded outcome decided it. Reading it has no side effects.
   */
  get nextDelay(): number {
    return this._nextDelayMs;
  }

  /**
   * Records a failed attempt and decides the wait before the next one.
   *
   * The state advances before the wait is computed, so {@link nextDelay}
   * always reflects the failure just recorded.
   */
  recordFailure(kind: FailureKind): void {
    // A reset that fell due during healthy operation is applied before the
    // new failure is counted, so the failure computes from a fresh sequence.
    this._resetIfDue();
    this._resetPolicy.noteFailure();

    if (kind === 'unexpected' && !this._extended) {
      // Moving to the extended regime raises both bounds and starts the delay
      // sequence over. Only the move does this: a later unexpected failure
      // keeps counting up rather than re-pinning the initial delay.
      this._extended = true;
      this._minDelayMs = this._extendedInitialDelayMs;
      this._maxDelayMs = this._extendedCeilingMs;
      this._attempts = 1;
    } else {
      this._attempts += 1;
    }

    const base = this._serverDirectedBaseMs ?? this._minDelayMs;
    // Compare against the ceiling scaled down rather than the base scaled up, so
    // the computed value can never overflow the ceiling. A base of zero doubles
    // to zero forever, so it short-circuits.
    let target = 0;
    if (base > 0) {
      const exponent = this._attempts - 1;
      target = base >= this._maxDelayMs / 2 ** exponent ? this._maxDelayMs : base * 2 ** exponent;
    }
    const jitter = (this._random() * target) / 2;
    this._nextDelayMs = Math.max(target - jitter, this._operatingCadenceMs);
  }

  /**
   * Records a successful operation and resets the retry state if that is now
   * enough to satisfy the reset policy.
   */
  recordSuccess(): void {
    this._resetPolicy.noteHealthy();
    this._resetIfDue();
    // A backoff wait applies to a retry, not to every operation, so after a
    // success the next wait is the ordinary interval even while the retry
    // state is raised.
    this._nextDelayMs = this._operatingCadenceMs;
  }

  /**
   * Applies a server-directed retry time.
   *
   * The value replaces the base of the delay computation and restarts the
   * doubling sequence. The regime and its ceiling are unaffected, and the
   * value stays in effect until another one arrives, including across a
   * reset. Non-finite or negative values are ignored; callers are expected to
   * have validated and capped the value at its point of entry.
   */
  applyServerDirectedRetry(delayMs: number): void {
    if (typeof delayMs !== 'number' || !Number.isFinite(delayMs) || delayMs < 0) {
      return;
    }
    this._serverDirectedBaseMs = delayMs;
    this._attempts = 0;
  }

  private _resetIfDue(): void {
    if (!this._resetPolicy.isSatisfied()) {
      return;
    }
    this._attempts = 0;
    this._extended = false;
    this._minDelayMs = this._normalInitialDelayMs;
    this._maxDelayMs = this._normalCeilingMs;
  }
}

/**
 * Builds the retry state for a streaming data source: no wait during healthy
 * operation, a normal regime running from the configured initial delay up to
 * a 30 second ceiling, an extended regime of 5 minutes up to 1 hour, and a
 * reset once a connection has been healthy for 60 seconds.
 *
 * The initial delay is validated here; the documented default of 1 second
 * stands in for anything that is not a positive, finite number. The extended
 * regime never starts below the configured delay.
 */
export function forStreaming(initialReconnectDelayMs: number, logger?: LDLogger): RetryState {
  const validated = positiveFiniteOrDefault(
    initialReconnectDelayMs,
    DEFAULT_STREAMING_INITIAL_DELAY_MS,
    'initialReconnectDelayMs',
    logger,
  );
  return new RetryState({
    normalInitialDelayMs: validated,
    normalCeilingMs: STREAMING_NORMAL_CEILING_MS,
    extendedInitialDelayMs: Math.max(EXTENDED_INITIAL_DELAY_MS, validated),
    extendedCeilingMs: EXTENDED_CEILING_MS,
    resetPolicy: new AfterHealthyFor(STREAMING_RESET_INTERVAL_MS),
    operatingCadenceMs: 0,
  });
}

/**
 * Builds the retry state for a polling data source: the poll interval is the
 * operating cadence, so no wait is ever shorter than it; in the normal regime
 * both bounds are the interval itself, so a normal failure simply polls again
 * on schedule; the extended regime runs from 5 minutes (or the interval, if
 * longer) up to 1 hour (or the interval, if longer); and the state resets
 * after two successful polls in a row.
 *
 * The poll interval is validated here; the documented default of 30 seconds
 * stands in for anything that is not a positive, finite number.
 */
export function forPolling(pollIntervalMs: number, logger?: LDLogger): RetryState {
  const validated = positiveFiniteOrDefault(
    pollIntervalMs,
    DEFAULT_POLL_INTERVAL_MS,
    'pollIntervalMs',
    logger,
  );
  return new RetryState({
    normalInitialDelayMs: validated,
    normalCeilingMs: validated,
    extendedInitialDelayMs: Math.max(EXTENDED_INITIAL_DELAY_MS, validated),
    extendedCeilingMs: Math.max(EXTENDED_CEILING_MS, validated),
    resetPolicy: new AfterConsecutiveSuccesses(POLLING_RESET_SUCCESSES),
    operatingCadenceMs: validated,
  });
}
