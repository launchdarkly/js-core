import Backoff from '../../src/platform/Backoff';

const noJitter = (): number => 0;
const maxJitter = (): number => 1;
const defaultResetInterval = 60 * 1000;

it.each([1, 1000, 5000])('has the correct starting delay', (initialDelay) => {
  const backoff = new Backoff(initialDelay, defaultResetInterval, noJitter);
  expect(backoff.fail()).toEqual(initialDelay);
});

it.each([1, 1000, 5000])('doubles delay on consecutive failures', (initialDelay) => {
  const backoff = new Backoff(initialDelay, defaultResetInterval, noJitter);
  expect(backoff.fail()).toEqual(initialDelay);
  expect(backoff.fail()).toEqual(initialDelay * 2);
  expect(backoff.fail()).toEqual(initialDelay * 4);
});

it('stops increasing delay when the max backoff is encountered', () => {
  const backoff = new Backoff(5000, defaultResetInterval, noJitter);
  expect(backoff.fail()).toEqual(5000);
  expect(backoff.fail()).toEqual(10000);
  expect(backoff.fail()).toEqual(20000);
  expect(backoff.fail()).toEqual(30000);

  const backoff2 = new Backoff(1000, defaultResetInterval, noJitter);
  expect(backoff2.fail()).toEqual(1000);
  expect(backoff2.fail()).toEqual(2000);
  expect(backoff2.fail()).toEqual(4000);
  expect(backoff2.fail()).toEqual(8000);
  expect(backoff2.fail()).toEqual(16000);
  expect(backoff2.fail()).toEqual(30000);
});

it('handles an initial retry delay longer than the maximum retry delay', () => {
  const backoff = new Backoff(40000, defaultResetInterval, noJitter);
  expect(backoff.fail()).toEqual(30000);
});

it('jitters the backoff value', () => {
  const backoff = new Backoff(1000, defaultResetInterval, maxJitter);
  expect(backoff.fail()).toEqual(500);
  expect(backoff.fail()).toEqual(1000);
  expect(backoff.fail()).toEqual(2000);
  expect(backoff.fail()).toEqual(4000);
  expect(backoff.fail()).toEqual(8000);
  expect(backoff.fail()).toEqual(15000);
});

it.each([10 * 1000, 60 * 1000])(
  'resets the delay when the last successful connection was connected greater than the retry reset interval',
  (retryResetInterval) => {
    let time = 1000;
    const backoff = new Backoff(1000, retryResetInterval, noJitter);
    expect(backoff.fail(time)).toEqual(1000);
    time += 1;
    backoff.success(time);
    time = time + retryResetInterval + 1;
    expect(backoff.fail(time)).toEqual(1000);
    time += 1;
    expect(backoff.fail(time)).toEqual(2000);
    time += 1;
    backoff.success(time);
    time = time + retryResetInterval + 1;
    expect(backoff.fail(time)).toEqual(1000);
  },
);

it.each([10 * 1000, 60 * 1000])(
  'does not reset the delay when the connection did not persist longer than the retry reset interval',
  (retryResetInterval) => {
    const backoff = new Backoff(1000, retryResetInterval, noJitter);

    let time = 1000;
    expect(backoff.fail(time)).toEqual(1000);
    time += 1;
    backoff.success(time);
    time += retryResetInterval;
    expect(backoff.fail(time)).toEqual(2000);
    time += retryResetInterval;
    expect(backoff.fail(time)).toEqual(4000);
    time += 1;
    backoff.success(time);
    time += retryResetInterval;
    expect(backoff.fail(time)).toEqual(8000);
  },
);
