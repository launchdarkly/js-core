import { createAsyncTaskQueue } from '../../src/async/AsyncTaskQueue';

it.each([true, false])(
  'executes the initial task it is given: sheddable: %s',
  async (sheddable) => {
    const queue = createAsyncTaskQueue<string>();
    const task = jest.fn().mockResolvedValue('test');
    const result = await queue.execute(task, sheddable);
    expect(queue.pendingCount()).toBe(0);
    expect(result).toEqual({
      status: 'complete',
      result: 'test',
    });
    expect(task).toHaveBeenCalled();
  },
);

it.each([true, false])(
  'executes the next task in the queue when the previous task completes: sheddable: %s',
  async (sheddable) => {
    const queue = createAsyncTaskQueue<string>();
    const task1 = jest.fn().mockResolvedValue('test1');
    const task2 = jest.fn().mockResolvedValue('test2');
    const promise1 = queue.execute(task1, sheddable);
    const promise2 = queue.execute(task2, sheddable);
    // We have not awaited, so there has not been an opportunity to execute any tasks.
    expect(queue.pendingCount()).toBe(1);

    const [result1, result2] = await Promise.all([promise1, promise2]);
    expect(result1).toEqual({
      status: 'complete',
      result: 'test1',
    });
    expect(result2).toEqual({
      status: 'complete',
      result: 'test2',
    });
    expect(task1).toHaveBeenCalled();
    expect(task2).toHaveBeenCalled();
  },
);

it('can shed pending sheddable tasks', async () => {
  const queue = createAsyncTaskQueue<string>();
  const task1 = jest.fn().mockResolvedValue('test1');
  const task2 = jest.fn().mockResolvedValue('test2');
  const task3 = jest.fn().mockResolvedValue('test3');
  const promise1 = queue.execute(task1, true);
  const promise2 = queue.execute(task2, true);
  const promise3 = queue.execute(task3, true);

  const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3]);
  expect(result1).toEqual({
    status: 'complete',
    result: 'test1',
  });
  expect(result2).toEqual({
    status: 'shed',
  });
  expect(result3).toEqual({
    status: 'complete',
    result: 'test3',
  });
  expect(task1).toHaveBeenCalled();
  expect(task2).not.toHaveBeenCalled();
  expect(task3).toHaveBeenCalled();
});

it('does not shed pending non-sheddable tasks', async () => {
  const queue = createAsyncTaskQueue<string>();
  const task1 = jest.fn().mockResolvedValue('test1');
  const task2 = jest.fn().mockResolvedValue('test2');
  const task3 = jest.fn().mockResolvedValue('test3');
  const promise1 = queue.execute(task1, false);
  const promise2 = queue.execute(task2, false);
  const promise3 = queue.execute(task3, false);

  const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3]);
  expect(result1).toEqual({
    status: 'complete',
    result: 'test1',
  });
  expect(result2).toEqual({
    status: 'complete',
    result: 'test2',
  });
  expect(result3).toEqual({
    status: 'complete',
    result: 'test3',
  });
  expect(task1).toHaveBeenCalled();
  expect(task2).toHaveBeenCalled();
  expect(task3).toHaveBeenCalled();
});

it('can handle errors from tasks', async () => {
  const queue = createAsyncTaskQueue<string>();
  const task1 = jest.fn().mockRejectedValue(new Error('test'));
  const task2 = jest.fn().mockResolvedValue('test2');
  const promise1 = queue.execute(task1, true);
  const promise2 = queue.execute(task2, true);
  const [result1, result2] = await Promise.all([promise1, promise2]);
  expect(result1).toEqual({
    status: 'error',
    error: new Error('test'),
  });
  expect(result2).toEqual({
    status: 'complete',
    result: 'test2',
  });
  expect(task1).toHaveBeenCalled();
  expect(task2).toHaveBeenCalled();
});

it('handles mix of sheddable and non-sheddable tasks correctly', async () => {
  const queue = createAsyncTaskQueue<string>();
  const task1 = jest.fn().mockResolvedValue('test1');
  const task2 = jest.fn().mockResolvedValue('test2');
  const task3 = jest.fn().mockResolvedValue('test3');
  const task4 = jest.fn().mockResolvedValue('test4');

  // Add tasks in order: sheddable, non-sheddable, sheddable, non-sheddable
  const promise1 = queue.execute(task1, true);
  const promise2 = queue.execute(task2, false);
  const promise3 = queue.execute(task3, true);
  const promise4 = queue.execute(task4, false);

  const [result1, result2, result3, result4] = await Promise.all([
    promise1,
    promise2,
    promise3,
    promise4,
  ]);

  // First task should complete
  expect(result1).toEqual({
    status: 'complete',
    result: 'test1',
  });

  // Second task should complete (not sheddable)
  expect(result2).toEqual({
    status: 'complete',
    result: 'test2',
  });

  // Third task should be shed
  expect(result3).toEqual({
    status: 'shed',
  });

  // Fourth task should complete
  expect(result4).toEqual({
    status: 'complete',
    result: 'test4',
  });

  expect(task1).toHaveBeenCalled();
  expect(task2).toHaveBeenCalled();
  expect(task3).not.toHaveBeenCalled();
  expect(task4).toHaveBeenCalled();
});

it('executes tasks in order regardless of time to complete', async () => {
  const queue = createAsyncTaskQueue<string>();
  const timedPromise = (ms: number) =>
    new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  const callOrder: string[] = [];
  const task1 = jest.fn().mockImplementation(() => {
    callOrder.push('task1Start');
    return timedPromise(10).then(() => {
      callOrder.push('task1End');
      return 'test1';
    });
  });
  const task2 = jest.fn().mockImplementation(() => {
    callOrder.push('task2Start');
    return timedPromise(5).then(() => {
      callOrder.push('task2End');
      return 'test2';
    });
  });
  const task3 = jest.fn().mockImplementation(() => {
    callOrder.push('task3Start');
    return timedPromise(20).then(() => {
      callOrder.push('task3End');
      return 'test3';
    });
  });
  const promise1 = queue.execute(task1, false);
  const promise2 = queue.execute(task2, false);
  const promise3 = queue.execute(task3, false);

  await Promise.all([promise1, promise2, promise3]);
  expect(callOrder).toEqual([
    'task1Start',
    'task1End',
    'task2Start',
    'task2End',
    'task3Start',
    'task3End',
  ]);
});
