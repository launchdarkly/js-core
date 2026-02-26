/**
 * A minimal promise-based producer/consumer queue.
 *
 * Producers call {@link put} to enqueue items. Consumers call {@link take}
 * to dequeue items. If no item is available, {@link take} returns a promise
 * that resolves when the next item is put.
 *
 * Multiple concurrent {@link take} calls are supported — each one receives
 * a distinct item in FIFO order.
 *
 * @internal
 */
export interface AsyncQueue<T> {
  /** Enqueue an item. If a consumer is waiting, it is delivered directly. */
  put(item: T): void;
  /** Dequeue the next item, or wait for one if the queue is empty. */
  take(): Promise<T>;
}

/**
 * Creates a new {@link AsyncQueue}.
 *
 * @internal
 */
export function createAsyncQueue<T>(): AsyncQueue<T> {
  const items: T[] = [];
  const waiters: Array<(item: T) => void> = [];

  return {
    put(item: T): void {
      const waiter = waiters.shift();
      if (waiter) {
        waiter(item);
      } else {
        items.push(item);
      }
    },

    take(): Promise<T> {
      if (items.length > 0) {
        return Promise.resolve(items.shift()!);
      }
      return new Promise<T>((resolve) => {
        waiters.push(resolve);
      });
    },
  };
}
