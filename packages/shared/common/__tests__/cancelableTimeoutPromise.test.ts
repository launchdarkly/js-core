import { LDTimeoutError } from '../src/errors';
import { cancelableTimedPromise } from '../src/utils/cancelableTimedPromise';

it('throws when it times out', async () => {
  try {
    await cancelableTimedPromise(0.1, 'test-task').promise;
    fail('timeout did not fire');
  } catch (err) {
    expect(err).toBeInstanceOf(LDTimeoutError);
  }
});

it('promise resolves when cancelled', async () => {
  // This test would take many minutes if the cancellation didn't work.
  const cancelableTimeout = cancelableTimedPromise(300, 'test-task');
  cancelableTimeout.cancel();
  await cancelableTimeout.promise;
});

it('can be used for timing out a task', async () => {
  const cancelableTimeout = cancelableTimedPromise(0.1, 'exampleTimeout');
  let timeout: ReturnType<typeof setTimeout>;
  const sampleTask = new Promise<void>((resolve, _reject) => {
    timeout = setTimeout(() => resolve, 1000);
  });

  try {
    await Promise.race([sampleTask, cancelableTimeout.promise]);
    fail('timeout did not fire');
  } catch (err) {
    expect(err).toBeInstanceOf(LDTimeoutError);
  }
  // @ts-ignore
  clearTimeout(timeout);
});

it('a raced promise can cancel the task', async () => {
  const cancelableTimeout = cancelableTimedPromise(1000, 'exampleTimeout');
  const sampleTask = new Promise<void>((resolve, _reject) => {
    setTimeout(resolve, 100);
  });

  try {
    await Promise.race([
      sampleTask.then(() => {
        cancelableTimeout.cancel();
      }),
      cancelableTimeout.promise,
    ]);
  } catch (err) {
    fail('should not have timed out');
  }
});
