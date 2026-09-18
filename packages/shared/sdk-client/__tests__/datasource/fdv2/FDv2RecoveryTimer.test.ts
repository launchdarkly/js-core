import { createFDv2RecoveryTimer } from '../../../src/datasource/fdv2/FDv2RecoveryTimer';

function wait(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

it('has no pending promise before anything is scheduled', () => {
  const timer = createFDv2RecoveryTimer();
  expect(timer.promise).toBeUndefined();
  timer.close();
});

it('resolves the pending promise once the scheduled ttl elapses', async () => {
  const timer = createFDv2RecoveryTimer();
  timer.schedule(10);
  const pending = timer.promise;
  expect(pending).toBeDefined();
  await expect(pending).resolves.toBeUndefined();
  timer.close();
});

it('keeps the resolved promise available until it is cleared', async () => {
  const timer = createFDv2RecoveryTimer();
  timer.schedule(1);
  await timer.promise;

  // A caller that was not waiting when the timer fired can still observe it.
  expect(timer.promise).toBeDefined();
  await timer.promise;

  timer.clear();
  expect(timer.promise).toBeUndefined();
});

it('remains usable for a new schedule after clear', async () => {
  const timer = createFDv2RecoveryTimer();
  timer.schedule(1);
  await timer.promise;
  timer.clear();

  timer.schedule(5);
  await expect(timer.promise).resolves.toBeUndefined();
  timer.close();
});

it('replaces a pending schedule with the newest ttl', async () => {
  const timer = createFDv2RecoveryTimer();
  timer.schedule(60000);
  const superseded = timer.promise;
  timer.schedule(5);
  expect(timer.promise).not.toBe(superseded);
  await expect(timer.promise).resolves.toBeUndefined();
  timer.close();
});

it('cancels a pending timer on clear', async () => {
  const timer = createFDv2RecoveryTimer();
  timer.schedule(5);
  const captured = timer.promise;
  timer.clear();
  expect(timer.promise).toBeUndefined();

  const outcome = await Promise.race([
    captured!.then(() => 'fired' as const),
    wait(30).then(() => 'timeout' as const),
  ]);
  expect(outcome).toBe('timeout');
  timer.close();
});

it('cancels a pending timer on close', async () => {
  const timer = createFDv2RecoveryTimer();
  timer.schedule(5);
  const captured = timer.promise;
  timer.close();
  expect(timer.promise).toBeUndefined();

  const outcome = await Promise.race([
    captured!.then(() => 'fired' as const),
    wait(30).then(() => 'timeout' as const),
  ]);
  expect(outcome).toBe('timeout');
});

it('ignores schedule after close', () => {
  const timer = createFDv2RecoveryTimer();
  timer.close();
  timer.schedule(5);
  expect(timer.promise).toBeUndefined();
});

it('clears the underlying timeout on close', () => {
  const timer = createFDv2RecoveryTimer();
  timer.schedule(60000);
  // @ts-ignore
  const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
  timer.close();
  expect(clearTimeoutSpy).toHaveBeenCalled();
  clearTimeoutSpy.mockRestore();
});

it('close is idempotent', () => {
  const timer = createFDv2RecoveryTimer();
  timer.schedule(60000);
  timer.close();
  timer.close();
  expect(timer.promise).toBeUndefined();
});
