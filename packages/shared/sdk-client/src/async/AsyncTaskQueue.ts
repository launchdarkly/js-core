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
  sheddable: boolean;
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
 * @param sheddable Whether the task can be shed from the queue.
 * @returns A pending task.
 */
function makePending<TTaskResult>(
  task: () => Promise<TTaskResult>,
  _logger?: LDLogger,
  sheddable: boolean = false,
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
    sheddable,
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
 * This queue will always begin execution of the first item added to the queue, at that point the item itself is not
 * queued, but active. If another request is made while that item is still active, then it is added to the queue.
 * A third request would then replace the second request if the second request had not yet become active, and it was
 * sheddable.
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
export function createAsyncTaskQueue<TTaskResult>(logger?: LDLogger) {
  let activeTask: Promise<TaskResult<TTaskResult>> | undefined;
  const queue: PendingTask<TTaskResult>[] = [];

  function checkPending() {
    // There is an existing active task, so we don't need to do anything.
    if (activeTask) {
      return;
    }

    // There are pending tasks, so we need to execute the next one.
    if (queue.length > 0) {
      const nextTask = queue.shift()!;

      activeTask = nextTask.promise.finally(() => {
        activeTask = undefined;
        checkPending();
      });

      nextTask.execute();
    }
  }

  return {
    /**
     * Execute a task using the queue.
     *
     * @param task The async function to execute.
     * @param sheddable Whether the task can be shed from the queue.
     * @returns A promise that resolves to the result of the task.
     */
    execute(
      task: () => Promise<TTaskResult>,
      sheddable: boolean = false,
    ): Promise<TaskResult<TTaskResult>> {
      const pending = makePending(task, logger, sheddable);

      if (!activeTask) {
        activeTask = pending.promise.finally(() => {
          activeTask = undefined;
          checkPending();
        });
        pending.execute();
      } else {
        // If the last pending task is sheddable, we need to shed it before adding the new task.
        if (queue[queue.length - 1]?.sheddable) {
          queue.pop()?.shed();
        }
        queue.push(pending);
      }

      return pending.promise;
    },

    /**
     * Returns the number of pending tasks in the queue.
     * Intended for testing purposes only.
     *
     * @internal
     * @returns The number of pending tasks in the queue.
     */
    pendingCount(): number {
      return queue.length;
    },
  };
}
