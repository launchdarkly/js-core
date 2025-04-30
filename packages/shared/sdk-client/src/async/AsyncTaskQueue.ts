import { LDLogger } from '@launchdarkly/js-sdk-common';

/**
 * Represents a task that has been shed from the queue.
 * This task will never be executed.
 */
export interface ShedTask {
  status: 'shed';
}

/**
 * Represents a task that has been ran to completion.
 */
export interface CompletedTask<TTaskResult> {
  status: 'complete';
  result: TTaskResult;
}

/**
 * Represents a task that has errored.
 */
export interface ErroredTask {
  status: 'error';
  error: Error;
}

/**
 * Represents the result of a task.
 */
export type TaskResult<TTaskResult> = CompletedTask<TTaskResult> | ErroredTask | ShedTask;

/**
 *  Represents a pending task. This encapsulates the async function that needs to be executed as well as a promise that represents its state.
 *  The promise is not directly the promise associated with the async function, because we will not execute the async function until some point in the future, if at all.
 * */
interface PendingTask<TTaskResult> {
  shedable: boolean;
  execute: () => void;
  shed: () => void;
  promise: Promise<TaskResult<TTaskResult>>;
}

const duplicateExecutionError = new Error(
  'Task has already been executed or shed. This is likely an implementation error. The task will not be executed again.',
);

/**
 * Creates a pending task.
 * @param task The async function to execute.
 * @param shedable Whether the task can be shed from the queue.
 * @returns A pending task.
 */
function makePending<TTaskResult>(
  task: () => Promise<TTaskResult>,
  _logger?: LDLogger,
  shedable: boolean = false,
): PendingTask<TTaskResult> {
  let res: (value: TaskResult<TTaskResult>) => void;

  const promise = new Promise<TaskResult<TTaskResult>>((resolve) => {
    res = resolve;
  });

  let executedOrShed = false;
  return {
    execute: () => {
      if (executedOrShed) {
        // This should never happen. If it does, then it represents an implementation error in the SDK.
        _logger?.error(duplicateExecutionError);
      }
      executedOrShed = true;
      task()
        .then((result) => res({ status: 'complete', result }))
        .catch((error) => res({ status: 'error', error }));
    },
    shed: () => {
      if (executedOrShed) {
        // This should never happen. If it does, then it represents an implementation error in the SDK.
        _logger?.error(duplicateExecutionError);
      }
      executedOrShed = true;
      res({ status: 'shed' });
    },
    promise,
    shedable,
  };
}

/**
 * An asynchronous task queue with the ability to replace pending tasks.
 *
 * This is useful when you have asynchronous operations which much execute in order, and for cases where intermediate
 * operations can be discarded.
 *
 * For instance, the SDK can only have one active context at a time, if you request identification of many contexts,
 * then the ultimate state will be based on the last request. The intermediate identifies can be discarded.
 *
 * This class will always begin execution of the first item added to the queue, at that point the item itself is not
 * queued, but active. If another request is made while that item is still active, then it is added to the queue.
 * A third request would then replace the second request if the second request had not yet become active, and it was
 * shedable.
 *
 * Once a task is active the queue will complete it. It doesn't cancel tasks that it has started, but it can shed tasks
 * that have not started.
 *
 * TTaskResult Is the return type of the task to be executed. Tasks accept no parameters. So if you need parameters
 * you should use a lambda to capture them.
 *
 * Exceptions from tasks are always handled and the execute method will never reject a promise.
 *
 * Queue management should be done synchronously. There should not be asynchronous operations between checking the queue
 * and acting on the results of said check.
 */
export class AsyncTaskQueue<TTaskResult> {
  private _activeTask?: Promise<TaskResult<TTaskResult>>;
  private _queue: PendingTask<TTaskResult>[] = [];

  constructor(private readonly _logger?: LDLogger) {}

  /**
   * Execute a task using the queue.
   *
   * @param task The async function to execute.
   * @param shedable Whether the task can be shed from the queue.
   * @returns A promise that resolves to the result of the task.
   */
  execute(
    task: () => Promise<TTaskResult>,
    shedable: boolean = false,
  ): Promise<TaskResult<TTaskResult>> {
    const pending = makePending(task, this._logger, shedable);

    if (!this._activeTask) {
      this._activeTask = pending.promise.finally(() => {
        this._activeTask = undefined;
        this._checkPending();
      });
      pending.execute();
    } else {
      // If the last pending task is shedable, we need to shed it before adding the new task.
      if (this._queue[this._queue.length - 1]?.shedable) {
        this._queue.pop()?.shed();
      }
      this._queue.push(pending);
    }

    return pending.promise;
  }

  private _checkPending() {
    // There is an existing active task, so we don't need to do anything.
    if (this._activeTask) {
      return;
    }

    // There are pending tasks, so we need to execute the next one.
    if (this._queue.length > 0) {
      const nextTask = this._queue.shift()!;

      this._activeTask = nextTask.promise.finally(() => {
        this._activeTask = undefined;
        this._checkPending();
      });

      nextTask.execute();
    }
  }

  /**
   * Returns the number of pending tasks in the queue.
   * Intended for testing purposes only.
   *
   * @internal
   * @returns The number of pending tasks in the queue.
   */
  public pendingCount(): number {
    return this._queue.length;
  }
}
