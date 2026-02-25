import { createAsyncQueue } from '../../../src/datasource/fdv2/AsyncQueue';

it('returns immediately when items are already buffered', async () => {
  const queue = createAsyncQueue<string>();

  queue.put('item1');

  const result = await queue.take();
  expect(result).toBe('item1');
});

it('resolves a waiting take when an item is put', async () => {
  const queue = createAsyncQueue<string>();

  const promise = queue.take();

  // The promise should not resolve yet — put hasn't been called
  let resolved = false;
  promise.then(() => {
    resolved = true;
  });

  // Flush microtasks
  await Promise.resolve();
  expect(resolved).toBe(false);

  queue.put('item1');

  const result = await promise;
  expect(result).toBe('item1');
});

it('preserves FIFO order for multiple puts then multiple takes', async () => {
  const queue = createAsyncQueue<number>();

  queue.put(1);
  queue.put(2);
  queue.put(3);

  expect(await queue.take()).toBe(1);
  expect(await queue.take()).toBe(2);
  expect(await queue.take()).toBe(3);
});

it('completes multiple pending takes in FIFO order', async () => {
  const queue = createAsyncQueue<number>();

  // Multiple takes when queue is empty
  const promise1 = queue.take();
  const promise2 = queue.take();
  const promise3 = queue.take();

  // None should be resolved yet
  let resolved1 = false;
  let resolved2 = false;
  let resolved3 = false;
  promise1.then(() => {
    resolved1 = true;
  });
  promise2.then(() => {
    resolved2 = true;
  });
  promise3.then(() => {
    resolved3 = true;
  });

  await Promise.resolve();
  expect(resolved1).toBe(false);
  expect(resolved2).toBe(false);
  expect(resolved3).toBe(false);

  // Put items — should complete futures in FIFO order
  queue.put(1);
  expect(await promise1).toBe(1);

  // After resolving promise1, promise2 and promise3 should still be pending
  await Promise.resolve();
  expect(resolved2).toBe(false);
  expect(resolved3).toBe(false);

  queue.put(2);
  expect(await promise2).toBe(2);

  await Promise.resolve();
  expect(resolved3).toBe(false);

  queue.put(3);
  expect(await promise3).toBe(3);
});

it('handles interleaved put and take operations', async () => {
  const queue = createAsyncQueue<string>();

  // Put one, take one
  queue.put('a');
  expect(await queue.take()).toBe('a');

  // Take when empty, then put
  const promise = queue.take();
  queue.put('b');
  expect(await promise).toBe('b');

  // Put multiple, take one, put one more, take remaining
  queue.put('c');
  queue.put('d');
  expect(await queue.take()).toBe('c');
  queue.put('e');
  expect(await queue.take()).toBe('d');
  expect(await queue.take()).toBe('e');
});

it('clears buffered items without affecting pending takes', async () => {
  const queue = createAsyncQueue<number>();

  queue.put(1);
  queue.put(2);
  queue.put(3);

  queue.clear();

  // The buffered items should be gone — take should now wait
  let resolved = false;
  const promise = queue.take();
  promise.then(() => {
    resolved = true;
  });
  await Promise.resolve();
  expect(resolved).toBe(false);

  // New put should resolve the waiting take
  queue.put(4);
  expect(await promise).toBe(4);
});

it('supports undefined values in buffered items', async () => {
  const queue = createAsyncQueue<string | undefined>();

  queue.put(undefined);
  queue.put('not-undefined');
  queue.put(undefined);

  expect(await queue.take()).toBeUndefined();
  expect(await queue.take()).toBe('not-undefined');
  expect(await queue.take()).toBeUndefined();
});

it('supports undefined values delivered to waiters', async () => {
  const queue = createAsyncQueue<string | undefined>();

  const promise1 = queue.take();
  const promise2 = queue.take();
  const promise3 = queue.take();

  queue.put(undefined);
  queue.put('not-undefined');
  queue.put(undefined);

  expect(await promise1).toBeUndefined();
  expect(await promise2).toBe('not-undefined');
  expect(await promise3).toBeUndefined();
});

it('handles many pending waiters being resolved by sequential puts', async () => {
  const queue = createAsyncQueue<number>();
  const count = 100;

  // Create many pending takes
  const promises: Promise<number>[] = [];
  for (let i = 0; i < count; i += 1) {
    promises.push(queue.take());
  }

  // Put items to resolve them
  for (let i = 0; i < count; i += 1) {
    queue.put(i);
  }

  // Verify all resolved in order
  const results = await Promise.all(promises);
  for (let i = 0; i < count; i += 1) {
    expect(results[i]).toBe(i);
  }
});

it('handles alternating take-put pattern', async () => {
  const queue = createAsyncQueue<number>();
  const count = 50;

  // Create take-put pairs and collect promises
  const promises: Promise<number>[] = [];
  Array.from({ length: count }).forEach((_, i) => {
    const promise = queue.take();
    queue.put(i);
    promises.push(promise);
  });

  const results = await Promise.all(promises);
  results.forEach((result, i) => {
    expect(result).toBe(i);
  });
});

it('handles alternating put-take pattern', async () => {
  const queue = createAsyncQueue<number>();
  const count = 50;

  // Put then take for each item, collecting promises
  const promises: Promise<number>[] = [];
  Array.from({ length: count }).forEach((_, i) => {
    queue.put(i);
    promises.push(queue.take());
  });

  const results = await Promise.all(promises);
  results.forEach((result, i) => {
    expect(result).toBe(i);
  });
});
