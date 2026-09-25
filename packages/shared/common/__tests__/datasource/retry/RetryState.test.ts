import {
  AfterConsecutiveSuccesses,
  AfterHealthyFor,
} from '../../../src/datasource/retry/ResetPolicy';
import {
  forPolling,
  forStreaming,
  RetryState,
  RetryStateConfig,
} from '../../../src/datasource/retry/RetryState';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

const noJitter = (): number => 0;

let now = 0;
const clock = (): number => now;

beforeEach(() => {
  now = 0;
});

function streamingState(overrides: Partial<RetryStateConfig> = {}): RetryState {
  return new RetryState({
    normalInitialDelayMs: 1000,
    normalCeilingMs: 30 * 1000,
    extendedInitialDelayMs: 5 * MINUTE,
    extendedCeilingMs: HOUR,
    resetPolicy: new AfterHealthyFor(MINUTE, clock),
    operatingCadenceMs: 0,
    random: noJitter,
    ...overrides,
  });
}

function pollingState(intervalMs: number, overrides: Partial<RetryStateConfig> = {}): RetryState {
  return new RetryState({
    normalInitialDelayMs: intervalMs,
    normalCeilingMs: intervalMs,
    extendedInitialDelayMs: Math.max(5 * MINUTE, intervalMs),
    extendedCeilingMs: Math.max(HOUR, intervalMs),
    resetPolicy: new AfterConsecutiveSuccesses(2),
    operatingCadenceMs: intervalMs,
    random: noJitter,
    ...overrides,
  });
}

it('reports the operating cadence before any outcome is recorded', () => {
  expect(streamingState().nextDelay).toEqual(0);
  expect(pollingState(30 * 1000).nextDelay).toEqual(30 * 1000);
});

it('doubles the delay on consecutive normal failures up to the normal ceiling', () => {
  const state = streamingState();
  const delays: number[] = [];
  for (let i = 0; i < 7; i += 1) {
    state.recordFailure('normal');
    delays.push(state.nextDelay);
  }
  expect(delays).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000]);
});

it('moves to the extended regime on the first unexpected failure', () => {
  const state = streamingState();
  state.recordFailure('normal');
  state.recordFailure('normal');
  state.recordFailure('unexpected');
  expect(state.nextDelay).toEqual(5 * MINUTE);
});

it('keeps doubling through the extended regime up to the extended ceiling', () => {
  const state = streamingState();
  state.recordFailure('unexpected');
  const delays = [state.nextDelay];
  for (let i = 0; i < 5; i += 1) {
    state.recordFailure('normal');
    delays.push(state.nextDelay);
  }
  expect(delays).toEqual([5 * MINUTE, 10 * MINUTE, 20 * MINUTE, 40 * MINUTE, HOUR, HOUR]);
});

it('does not re-pin the initial delay on a later unexpected failure', () => {
  const state = streamingState();
  state.recordFailure('unexpected');
  expect(state.nextDelay).toEqual(5 * MINUTE);
  state.recordFailure('unexpected');
  expect(state.nextDelay).toEqual(10 * MINUTE);
});

it('does not lower the bounds when a normal failure follows an unexpected one', () => {
  const state = streamingState();
  state.recordFailure('unexpected');
  state.recordFailure('normal');
  expect(state.nextDelay).toEqual(10 * MINUTE);
});

it('resets after the component has been healthy for the reset duration', () => {
  const state = streamingState();
  state.recordFailure('unexpected');
  state.recordFailure('normal');

  now = 10 * MINUTE;
  state.recordSuccess();
  now += MINUTE + 1;
  state.recordFailure('normal');
  expect(state.nextDelay).toEqual(1000);
});

it('does not reset when the healthy stretch is shorter than the reset duration', () => {
  const state = streamingState();
  state.recordFailure('unexpected');

  now = 10 * MINUTE;
  state.recordSuccess();
  now += MINUTE - 1;
  state.recordFailure('normal');
  expect(state.nextDelay).toEqual(10 * MINUTE);
});

it('anchors the healthy stretch at the first success rather than the latest', () => {
  const state = streamingState();
  state.recordFailure('normal');
  state.recordFailure('normal');

  now = 10 * MINUTE;
  state.recordSuccess();
  now += 30 * 1000;
  state.recordSuccess();
  now += 31 * 1000;
  // 61 seconds since the first success; if repeated successes moved the
  // anchor, only 31 seconds would have elapsed and no reset would occur.
  state.recordFailure('normal');
  expect(state.nextDelay).toEqual(1000);
});

it('continues the delay progression when a success is not enough to reset', () => {
  const state = streamingState();
  state.recordFailure('normal');
  state.recordFailure('normal');
  state.recordSuccess();
  state.recordFailure('normal');
  expect(state.nextDelay).toEqual(4000);
});

it('returns to the operating cadence after a success even while the state is raised', () => {
  const state = pollingState(30 * 1000);
  state.recordFailure('unexpected');
  expect(state.nextDelay).toEqual(5 * MINUTE);
  state.recordSuccess();
  expect(state.nextDelay).toEqual(30 * 1000);
});

it('stays in the extended regime until two consecutive polls succeed', () => {
  const state = pollingState(30 * 1000);
  state.recordFailure('unexpected');
  state.recordSuccess();
  state.recordFailure('normal');
  expect(state.nextDelay).toEqual(10 * MINUTE);
});

it('resets after two consecutive successful polls', () => {
  const state = pollingState(30 * 1000);
  state.recordFailure('unexpected');
  state.recordSuccess();
  state.recordSuccess();
  state.recordFailure('normal');
  expect(state.nextDelay).toEqual(30 * 1000);
});

it('re-arms the extended transition after a reset', () => {
  const state = pollingState(30 * 1000);
  state.recordFailure('unexpected');
  state.recordSuccess();
  state.recordSuccess();
  state.recordFailure('unexpected');
  expect(state.nextDelay).toEqual(5 * MINUTE);
});

it('clears the reset progress when a failure lands between successes', () => {
  const state = pollingState(30 * 1000);
  state.recordFailure('unexpected');
  state.recordSuccess();
  state.recordFailure('normal');
  state.recordSuccess();
  state.recordFailure('normal');
  // Still extended: the intervening failures kept the reset from occurring.
  expect(state.nextDelay).toEqual(20 * MINUTE);
});

it('never waits less than the poll interval in the normal regime', () => {
  const state = pollingState(30 * 1000, { random: Math.random });
  for (let i = 0; i < 100; i += 1) {
    state.recordFailure('normal');
    expect(state.nextDelay).toEqual(30 * 1000);
  }
});

it('jitters the wait into the upper half of the target delay', () => {
  for (let i = 0; i < 100; i += 1) {
    const state = streamingState({ random: Math.random });
    state.recordFailure('normal');
    state.recordFailure('normal');
    // Target is 2000; the wait must be in (1000, 2000].
    expect(state.nextDelay).toBeGreaterThan(1000);
    expect(state.nextDelay).toBeLessThanOrEqual(2000);
  }
});

it('uses a server-directed retry time as the new base and restarts the doubling', () => {
  const state = streamingState();
  state.recordFailure('normal');
  state.recordFailure('normal');
  state.recordFailure('normal');
  expect(state.nextDelay).toEqual(4000);
  state.applyServerDirectedRetry(2500);
  state.recordFailure('normal');
  expect(state.nextDelay).toEqual(2500);
  state.recordFailure('normal');
  expect(state.nextDelay).toEqual(5000);
});

it('clamps a server-directed retry time to the regime ceiling', () => {
  const state = streamingState();
  state.applyServerDirectedRetry(2 * HOUR);
  state.recordFailure('normal');
  expect(state.nextDelay).toEqual(30 * 1000);
});

it('keeps a server-directed retry time across a reset', () => {
  const state = streamingState();
  state.applyServerDirectedRetry(2500);
  state.recordFailure('normal');

  now = 10 * MINUTE;
  state.recordSuccess();
  now += MINUTE + 1;
  state.recordFailure('normal');
  expect(state.nextDelay).toEqual(2500);
});

it.each([Number.NaN, -1, Number.POSITIVE_INFINITY])(
  'ignores the invalid server-directed retry time %p',
  (value) => {
    const state = streamingState();
    state.recordFailure('normal');
    state.recordFailure('normal');
    state.applyServerDirectedRetry(value);
    state.recordFailure('normal');
    expect(state.nextDelay).toEqual(4000);
  },
);

it('remains at the ceiling without overflowing after very many failures', () => {
  const state = streamingState();
  state.recordFailure('unexpected');
  for (let i = 0; i < 500; i += 1) {
    state.recordFailure('normal');
  }
  expect(state.nextDelay).toEqual(HOUR);
  expect(Number.isFinite(state.nextDelay)).toEqual(true);
});

it('stays finite when a server-directed retry time of zero is followed by very many failures', () => {
  const state = streamingState();
  state.applyServerDirectedRetry(0);
  for (let i = 0; i < 1100; i += 1) {
    state.recordFailure('normal');
  }
  expect(state.nextDelay).toEqual(0);
  expect(Number.isFinite(state.nextDelay)).toEqual(true);
});

it('floors a zero server-directed retry time at the operating cadence', () => {
  const state = pollingState(30 * 1000);
  state.applyServerDirectedRetry(0);
  state.recordFailure('normal');
  expect(state.nextDelay).toEqual(30 * 1000);
});

it('binds streaming defaults through the factory', () => {
  const state = forStreaming(1000);
  expect(state.nextDelay).toEqual(0);
});

it('binds polling defaults through the factory', () => {
  const state = forPolling(30 * 1000);
  expect(state.nextDelay).toEqual(30 * 1000);
});

it.each([0, -5, Number.NaN, Number.POSITIVE_INFINITY])(
  'warns and uses the default when the streaming initial delay is %p',
  (value) => {
    const warn = jest.fn();
    const logger = { error: jest.fn(), warn, info: jest.fn(), debug: jest.fn() };
    forStreaming(value, logger);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/initialReconnectDelayMs/);
  },
);

it.each([0, -5, Number.NaN, Number.POSITIVE_INFINITY])(
  'warns and uses the default when the poll interval is %p',
  (value) => {
    const warn = jest.fn();
    const logger = { error: jest.fn(), warn, info: jest.fn(), debug: jest.fn() };
    const state = forPolling(value, logger);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(state.nextDelay).toEqual(30 * 1000);
  },
);

it('does not warn for valid factory inputs', () => {
  const warn = jest.fn();
  const logger = { error: jest.fn(), warn, info: jest.fn(), debug: jest.fn() };
  forStreaming(1000, logger);
  forPolling(30 * 1000, logger);
  expect(warn).not.toHaveBeenCalled();
});
