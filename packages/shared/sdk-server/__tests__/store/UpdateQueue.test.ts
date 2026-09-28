import UpdateQueue from '../../src/store/UpdateQueue';

it('forwards an error from the update function to the original callback', (done) => {
  const queue = new UpdateQueue();
  queue.enqueue(
    (cb) => cb(new Error('bad')),
    (err) => {
      expect(err).toEqual(new Error('bad'));
      done();
    },
  );
});

it('forwards no error when the update function succeeds', (done) => {
  const queue = new UpdateQueue();
  queue.enqueue(
    (cb) => cb(),
    (err) => {
      expect(err).toBeUndefined();
      done();
    },
  );
});

it('waits for a slow update instead of running the next one, and warns', async () => {
  jest.useFakeTimers();
  try {
    const logger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };
    const queue = new UpdateQueue(logger);
    let slowCallback: ((err?: Error) => void) | undefined;
    const firstCallback = jest.fn();
    const secondCallback = jest.fn();

    queue.enqueue((cb) => {
      slowCallback = cb;
    }, firstCallback);
    queue.enqueue((cb) => cb(), secondCallback);

    // Well past the warning deadline, the slow update still holds the queue.
    // The warning fires exactly once.
    await jest.advanceTimersByTimeAsync(120000);
    expect(secondCallback).not.toHaveBeenCalled();
    expect(firstCallback).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn.mock.calls[0][0]).toMatch(/did not complete within 30 seconds/);

    // The slow update finally answers. It completes normally, and the next update
    // runs through a zero-delay chain timer.
    slowCallback?.();
    await jest.advanceTimersByTimeAsync(1);
    expect(firstCallback).toHaveBeenCalledTimes(1);
    expect(firstCallback).toHaveBeenCalledWith(undefined);
    expect(secondCallback).toHaveBeenCalledTimes(1);
  } finally {
    jest.useRealTimers();
  }
});

it('does not warn about an update that completes before the deadline', async () => {
  jest.useFakeTimers();
  try {
    const logger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };
    const queue = new UpdateQueue(logger);
    queue.enqueue(
      (cb) => cb(),
      () => {},
    );

    await jest.advanceTimersByTimeAsync(120000);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toEqual(0);
  } finally {
    jest.useRealTimers();
  }
});

it('ignores a second answer from an update that already completed', async () => {
  jest.useFakeTimers();
  try {
    const queue = new UpdateQueue();
    let doubleCallback: ((err?: Error) => void) | undefined;
    const firstCallback = jest.fn();
    const secondCallback = jest.fn();

    queue.enqueue((cb) => {
      doubleCallback = cb;
      cb();
    }, firstCallback);
    queue.enqueue((cb) => cb(), secondCallback);
    await jest.advanceTimersByTimeAsync(1);

    // The first update answers a second time. It must not shift an update it
    // does not own.
    doubleCallback?.();
    await jest.advanceTimersByTimeAsync(1);

    expect(firstCallback).toHaveBeenCalledTimes(1);
    expect(secondCallback).toHaveBeenCalledTimes(1);
  } finally {
    jest.useRealTimers();
  }
});

it('contains a synchronous throw from an update behind a busy head', async () => {
  jest.useFakeTimers();
  try {
    const queue = new UpdateQueue();
    let releaseFirst: ((err?: Error) => void) | undefined;
    const throwingCallback = jest.fn();
    const thirdCallback = jest.fn();

    queue.enqueue((cb) => {
      releaseFirst = cb;
    }, jest.fn());
    queue.enqueue(() => {
      throw new Error('sync boom');
    }, throwingCallback);
    queue.enqueue((cb) => cb(), thirdCallback);

    // The throwing update runs from the chain timer once the head completes. The
    // throw must be contained, fail only its own update, and let the next run.
    releaseFirst?.();
    await jest.advanceTimersByTimeAsync(1);

    expect(throwingCallback).toHaveBeenCalledWith(new Error('sync boom'));
    expect(thirdCallback).toHaveBeenCalledTimes(1);
  } finally {
    jest.useRealTimers();
  }
});

it('fails waiting updates without running them when the queue closes', async () => {
  jest.useFakeTimers();
  try {
    const queue = new UpdateQueue();
    const hungCallback = jest.fn();
    const waitingFn = jest.fn();
    const waitingCallback = jest.fn();

    queue.enqueue(() => {}, hungCallback);
    queue.enqueue(waitingFn, waitingCallback);

    queue.close();
    expect(hungCallback).toHaveBeenCalledWith(new Error('The store is closed.'));
    expect(waitingCallback).toHaveBeenCalledWith(new Error('The store is closed.'));
    expect(waitingFn).not.toHaveBeenCalled();

    // The warning timer was cleared, so nothing more fires.
    await jest.advanceTimersByTimeAsync(60000);
    expect(hungCallback).toHaveBeenCalledTimes(1);
    expect(waitingCallback).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toEqual(0);
  } finally {
    jest.useRealTimers();
  }
});

it('fails an update enqueued after close without running it', () => {
  const queue = new UpdateQueue();
  queue.close();
  const fn = jest.fn();
  const cb = jest.fn();
  queue.enqueue(fn, cb);
  expect(fn).not.toHaveBeenCalled();
  expect(cb).toHaveBeenCalledWith(new Error('The store is closed.'));
});
