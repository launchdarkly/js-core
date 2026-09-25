import {
  AfterConsecutiveSuccesses,
  AfterHealthyFor,
} from '../../../src/datasource/retry/ResetPolicy';

const MINUTE = 60 * 1000;

let now = 0;
const clock = (): number => now;

beforeEach(() => {
  now = 0;
});

it('is not satisfied before any healthy report', () => {
  const policy = new AfterHealthyFor(MINUTE, clock);
  now = 10 * MINUTE;
  expect(policy.isSatisfied()).toEqual(false);
});

it('is satisfied once the healthy stretch reaches the threshold, and not a moment sooner', () => {
  const policy = new AfterHealthyFor(MINUTE, clock);
  policy.noteHealthy();
  now = MINUTE - 1;
  expect(policy.isSatisfied()).toEqual(false);
  now = MINUTE;
  expect(policy.isSatisfied()).toEqual(true);
});

it('does not move the start of the stretch on repeated healthy reports', () => {
  const policy = new AfterHealthyFor(MINUTE, clock);
  policy.noteHealthy();
  for (let i = 1; i < 60; i += 1) {
    now = i * 1000;
    policy.noteHealthy();
    expect(policy.isSatisfied()).toEqual(false);
  }
  now = MINUTE;
  expect(policy.isSatisfied()).toEqual(true);
});

it('clears the healthy stretch on a failure', () => {
  const policy = new AfterHealthyFor(MINUTE, clock);
  policy.noteHealthy();
  now = 30 * 1000;
  policy.noteFailure();
  now = 15 * MINUTE;
  expect(policy.isSatisfied()).toEqual(false);
});

it('is satisfied by consecutive successes and not by fewer', () => {
  const policy = new AfterConsecutiveSuccesses(2);
  expect(policy.isSatisfied()).toEqual(false);
  policy.noteHealthy();
  expect(policy.isSatisfied()).toEqual(false);
  policy.noteHealthy();
  expect(policy.isSatisfied()).toEqual(true);
});

it('starts the success count over on a failure', () => {
  const policy = new AfterConsecutiveSuccesses(2);
  policy.noteHealthy();
  policy.noteFailure();
  policy.noteHealthy();
  expect(policy.isSatisfied()).toEqual(false);
  policy.noteHealthy();
  expect(policy.isSatisfied()).toEqual(true);
});

it('measures the healthy stretch with the default clock', () => {
  const policy = new AfterHealthyFor(60 * MINUTE);
  expect(policy.isSatisfied()).toEqual(false);
  policy.noteHealthy();
  expect(policy.isSatisfied()).toEqual(false);
});

it('falls back to the wall clock when no monotonic source exists', () => {
  const savedPerformance = (globalThis as any).performance;
  const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(0);
  delete (globalThis as any).performance;
  try {
    const policy = new AfterHealthyFor(MINUTE);
    policy.noteHealthy();
    expect(policy.isSatisfied()).toEqual(false);
    nowSpy.mockReturnValue(MINUTE);
    expect(policy.isSatisfied()).toEqual(true);
  } finally {
    nowSpy.mockRestore();
    (globalThis as any).performance = savedPerformance;
  }
});
