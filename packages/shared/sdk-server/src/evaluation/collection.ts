/**
 * Iterate a collection any apply the specified operation. The first operation which
 * returns a value will be returned and iteration will stop.
 *
 * @param collection The collection to enumerate.
 * @param operator The operation to apply to each item.
 * @returns The result of the first successful operation.
 */
export function firstResult<T, U>(
  collection: T[] | undefined,
  operator: (val: T, index: number) => U | undefined,
): U | undefined {
  let res;
  collection?.some((item, index) => {
    res = operator(item, index);
    return !!res;
  });
  return res;
}

/**
 * Receives an exception from an iteration step that runs outside the caller's stack: a step
 * deferred to a resolved promise, or a concurrent check or completion callback in allAsync.
 * Without a handler such an exception is an unhandled rejection and the completion callback
 * never runs. Steps on the caller's stack propagate to the caller as usual.
 */
export type IterationErrorHandler = (err: unknown) => void;

const ITERATION_RECURSION_LIMIT = 50;

function seriesAsync<T>(
  collection: T[] | undefined,
  check: (val: T, index: number, cb: (res: boolean) => void) => void,
  all: boolean,
  index: number,
  cb: (res: boolean) => void,
  onError?: IterationErrorHandler,
): void {
  if (!collection) {
    cb(false);
    return;
  }
  if (index < collection?.length) {
    check(collection[index], index, (res) => {
      if (all) {
        if (!res) {
          cb(false);
          return;
        }
      } else if (res) {
        cb(true);
        return;
      }
      if (collection.length > ITERATION_RECURSION_LIMIT) {
        // When we hit the recursion limit we defer execution
        // by using a resolved promise. This is similar to using setImmediate
        // but more portable.
        Promise.resolve().then(() => {
          // This step runs from the microtask queue, outside any try/catch the caller has
          // around the iteration, so an exception here goes to the caller's handler.
          try {
            seriesAsync(collection, check, all, index + 1, cb, onError);
          } catch (err) {
            if (!onError) {
              throw err;
            }
            onError(err);
          }
        });
      } else {
        seriesAsync(collection, check, all, index + 1, cb, onError);
      }
    });
  } else {
    cb(all);
  }
}

/**
 * Iterate a collection in series awaiting each check operation.
 * @param collection The collection to iterate.
 * @param check The check to perform for each item in the container.
 * @param cb Called with true if all items pass the check.
 * @param onError Receives an exception from a step deferred past the recursion limit.
 */
export function allSeriesAsync<T>(
  collection: T[] | undefined,
  check: (val: T, index: number, cb: (res: boolean) => void) => void,
  cb: (res: boolean) => void,
  onError?: IterationErrorHandler,
): void {
  seriesAsync(collection, check, true, 0, cb, onError);
}

/**
 * Iterate a collection in series awaiting each check operation.
 * @param collection The collection to iterate.
 * @param check The check to perform for each item in the container.
 * @param cb called with true on the first item that passes the check. False
 * means no items passed the check.
 * @param onError Receives an exception from a step deferred past the recursion limit.
 */
export function firstSeriesAsync<T>(
  collection: T[] | undefined,
  check: (val: T, index: number, cb: (res: boolean) => void) => void,
  cb: (res: boolean) => void,
  onError?: IterationErrorHandler,
): void {
  seriesAsync(collection, check, false, 0, cb, onError);
}

/**
 * Iterate a collection and execute the the given check operation
 * for all items concurrently.
 * @param collection The collection to iterate.
 * @param check The check to run for each item.
 * @param cb Callback executed when all items have been checked. The callback
 * will be called with true if each item resulted in true, otherwise it will
 * be called with false.
 * @param onError Receives an exception thrown by a check or by cb.
 */
export function allAsync<T>(
  collection: T[] | undefined,
  check: (val: T, cb: (res: boolean) => void) => void,
  cb: (res: boolean | null | undefined) => void,
  onError?: IterationErrorHandler,
): void {
  if (!collection) {
    cb(false);
    return;
  }

  const completion = Promise.all(
    collection?.map(
      (item) =>
        new Promise((resolve) => {
          check(item, resolve);
        }),
    ),
  ).then((results) => {
    cb(results.every((success) => success));
  });
  if (onError) {
    // A throw inside a check rejects its promise and a throw inside cb rejects the chain. Either
    // would otherwise be an unhandled rejection, with cb never called.
    completion.catch(onError);
  }
}
