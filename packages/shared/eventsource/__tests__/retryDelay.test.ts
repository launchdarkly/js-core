import { defaultBackoff, defaultJitter, RetryDelayStrategy } from '../src/retryDelay';

function expectInRange(value: number, min: number, max: number) {
  expect(value).toBeGreaterThanOrEqual(min);
  expect(value).toBeLessThanOrEqual(max);
}

it('can return fixed delay with no backoff or jitter', () => {
  const d0 = 1000;
  const r = new RetryDelayStrategy(d0, 0);
  const t0 = new Date().getTime() - 10000;
  expect(r.nextRetryDelay(t0)).toEqual(d0);
  expect(r.nextRetryDelay(t0 + 1000)).toEqual(d0);
  expect(r.nextRetryDelay(t0 + 2000)).toEqual(d0);
});

it('can use backoff without jitter', () => {
  const d0 = 10000;
  const max = 60000;
  const r = new RetryDelayStrategy(d0, 0, defaultBackoff(max));
  const t0 = new Date().getTime() - 10000;
  expect(r.nextRetryDelay(t0)).toEqual(d0);
  expect(r.nextRetryDelay(t0 + 1000)).toEqual(d0 * 2);
  expect(r.nextRetryDelay(t0 + 2000)).toEqual(d0 * 4);
  expect(r.nextRetryDelay(t0 + 3000)).toEqual(max);
});

it('can use jitter without backoff', () => {
  const d0 = 1000;
  const r = new RetryDelayStrategy(d0, 0, null, defaultJitter(0.5));
  const t0 = new Date().getTime() - 10000;
  expectInRange(r.nextRetryDelay(t0), d0 / 2, d0);
  expectInRange(r.nextRetryDelay(t0 + 1000), d0 / 2, d0);
  expectInRange(r.nextRetryDelay(t0 + 2000), d0 / 2, d0);
});

it('can use jitter with backoff', () => {
  const d0 = 10000;
  const max = 60000;
  const r = new RetryDelayStrategy(d0, 0, defaultBackoff(max), defaultJitter(0.5));
  const t0 = new Date().getTime() - 10000;
  expectInRange(r.nextRetryDelay(t0), d0 / 2, d0);
  expectInRange(r.nextRetryDelay(t0 + 1000), d0, d0 * 2);
  expectInRange(r.nextRetryDelay(t0 + 2000), d0 * 2, d0 * 4);
  expectInRange(r.nextRetryDelay(t0 + 3000), max / 2, max);
});

it('can reset backoff based on reset interval', () => {
  const d0 = 10000;
  const max = 60000;
  const resetInterval = 45000;
  const r = new RetryDelayStrategy(d0, resetInterval, defaultBackoff(max));
  const t0 = new Date().getTime() - 10000;
  r.setGoodSince(t0);

  const t1 = t0 + 1000;
  const d1 = r.nextRetryDelay(t1);
  expect(d1).toEqual(d0);

  const t2 = t1 + d1;
  r.setGoodSince(t2);

  const t3 = t2 + 10000;
  const d2 = r.nextRetryDelay(t3);
  expect(d2).toEqual(d0 * 2);

  const t4 = t3 + d2;
  r.setGoodSince(t4);

  const t5 = t4 + resetInterval;
  expect(r.nextRetryDelay(t5)).toEqual(d0);
});

it('resets the retry count when the base delay is changed', () => {
  const d0 = 1000;
  const r = new RetryDelayStrategy(d0, 0, defaultBackoff(60000));
  const t0 = new Date().getTime() - 10000;
  expect(r.nextRetryDelay(t0)).toEqual(d0);
  expect(r.nextRetryDelay(t0)).toEqual(d0 * 2);
  r.setBaseDelay(500);
  expect(r.nextRetryDelay(t0)).toEqual(500);
});

it('correctly handles backoff and jitter with high retry count', () => {
  // Verifies that we don't get numeric overflow errors due to using a very high exponential
  // backoff that should not be a concern in floating point.
  const d0 = 1000;
  const max = 1000 * 60 * 60 * 24 * 365 * 200; // 200 years
  const retryCount = 35; // 2^35 seconds
  const r = new RetryDelayStrategy(d0, 0, defaultBackoff(max), defaultJitter(0.5));

  let d = 0;
  for (let i = 0; i < retryCount; i += 1) {
    d = r.nextRetryDelay(new Date().getTime());
  }
  expectInRange(d, max / 2, max);
});
