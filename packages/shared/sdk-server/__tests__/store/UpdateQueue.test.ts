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

it('abandons an update that does not answer within the deadline and runs the next one', async () => {
  jest.useFakeTimers();
  try {
    const queue = new UpdateQueue();
    const hungCallback = jest.fn();
    let secondRan = false;

    // The first update never calls back.
    queue.enqueue(() => {}, hungCallback);
    queue.enqueue(
      (cb) => {
        secondRan = true;
        cb();
      },
      () => {},
    );

    await jest.advanceTimersByTimeAsync(29999);
    expect(secondRan).toBe(false);
    expect(hungCallback).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1);
    // The next update runs through a zero-delay chain timer.
    await jest.advanceTimersByTimeAsync(1);
    expect(secondRan).toBe(true);
    expect(hungCallback).toHaveBeenCalledTimes(1);
    expect(hungCallback.mock.calls[0][0]).toEqual(
      new Error('The queued store operation did not complete in time.'),
    );
  } finally {
    jest.useRealTimers();
  }
});

it('ignores the late callback of an abandoned update', async () => {
  jest.useFakeTimers();
  try {
    const queue = new UpdateQueue();
    let lateCallback: ((err?: Error) => void) | undefined;
    const firstCallback = jest.fn();
    const secondCallback = jest.fn();
    const thirdCallback = jest.fn();

    queue.enqueue((cb) => {
      lateCallback = cb;
    }, firstCallback);
    // The second update stays queued behind the hung one, then behind its own work.
    queue.enqueue((cb) => cb(), secondCallback);

    // The deadline abandons the first update and runs the second through a
    // zero-delay chain timer.
    await jest.advanceTimersByTimeAsync(30000);
    await jest.advanceTimersByTimeAsync(1);
    expect(secondCallback).toHaveBeenCalledTimes(1);

    // The abandoned update finally answers. It must not shift an update it does
    // not own.
    lateCallback?.();
    queue.enqueue((cb) => cb(), thirdCallback);
    await jest.advanceTimersByTimeAsync(1);

    expect(firstCallback).toHaveBeenCalledTimes(1);
    expect(secondCallback).toHaveBeenCalledTimes(1);
    expect(thirdCallback).toHaveBeenCalledTimes(1);
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

    // The hang deadline was cleared, so nothing more fires.
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
