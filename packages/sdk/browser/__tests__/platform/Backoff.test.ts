import Backoff from '../../src/platform/Backoff';

const noJitter = (): number => 0;
const maxJitter = (): number => 1;

it.each([1, 1000, 5000])('has the correct starting delay', (initialDelay) => {
  const backoff = new Backoff(initialDelay, noJitter);
  expect(backoff.fail()).toEqual(initialDelay);
});

it.each([1, 1000, 5000])('doubles delay on consecutive failures', (initialDelay) => {
  const backoff = new Backoff(initialDelay, noJitter);
  expect(backoff.fail()).toEqual(initialDelay);
  expect(backoff.fail()).toEqual(initialDelay * 2);
  expect(backoff.fail()).toEqual(initialDelay * 4);
});

it('stops increasing delay when the max backoff is encountered', () => {
  const backoff = new Backoff(5000, noJitter);
  expect(backoff.fail()).toEqual(5000);
  expect(backoff.fail()).toEqual(10000);
  expect(backoff.fail()).toEqual(20000);
  expect(backoff.fail()).toEqual(30000);

  const backoff2 = new Backoff(1000, noJitter);
  expect(backoff2.fail()).toEqual(1000);
  expect(backoff2.fail()).toEqual(2000);
  expect(backoff2.fail()).toEqual(4000);
  expect(backoff2.fail()).toEqual(8000);
  expect(backoff2.fail()).toEqual(16000);
  expect(backoff2.fail()).toEqual(30000);
});

it('handles an initial retry delay longer than the maximum retry delay', () => {
  const backoff = new Backoff(40000, noJitter);
  expect(backoff.fail()).toEqual(30000);
});

it('jitters the backoff value', () => {
  const backoff = new Backoff(1000, maxJitter);
  expect(backoff.fail()).toEqual(500);
  expect(backoff.fail()).toEqual(1000);
  expect(backoff.fail()).toEqual(2000);
  expect(backoff.fail()).toEqual(4000);
  expect(backoff.fail()).toEqual(8000);
  expect(backoff.fail()).toEqual(15000);
});

it('resets the delay when the last successful connection was connected greater than RESET_INTERVAL', () => {
  const backoff = new Backoff(1000, noJitter);
  expect(backoff.fail(1000)).toEqual(1000);
  backoff.success(2000);
  expect(backoff.fail(62001)).toEqual(1000);
  expect(backoff.fail(62002)).toEqual(2000);
  backoff.success(64002);
  expect(backoff.fail(124003)).toEqual(1000);
});

it('does not reset the delay when the connection did not persist longer than the RESET_INTERVAL', () => {
  const backoff = new Backoff(1000, noJitter);
  expect(backoff.fail(1000)).toEqual(1000);
  backoff.success(2000);
  expect(backoff.fail(61000)).toEqual(2000);
  expect(backoff.fail(120000)).toEqual(4000);
  backoff.success(124000);
  expect(backoff.fail(183000)).toEqual(8000);
});
