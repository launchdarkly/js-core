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
 * Receives an exception thrown by a check or completion callback during asynchronous
 * iteration. Iteration stops and the completion callback is not called, so the caller
 * can report the failure instead of waiting for a result that would never arrive.
 */
export type IterationErrorHandler = (err: unknown) => void;

const ITERATION_RECURSION_LIMIT = 50;

function seriesAsync<T>(
  collection: T[] | undefined,
  check: (val: T, index: number, cb: (res: boolean) => void) => void,
  all: boolean,
  index: number,
  cb: (res: boolean) => void,
  onError: IterationErrorHandler,
): void {
  try {
    if (!collection) {
      cb(false);
      return;
    }
    if (!Array.isArray(collection)) {
      // A string would be indexed character by character and an object would be treated as
      // an empty collection, so a value that is not an array is reported instead of iterated.
      throw new TypeError(`Expected an array but received ${typeof collection}`);
    }
    if (index >= collection.length) {
      cb(all);
      return;
    }
    check(collection[index], index, (res) => {
      // The check may call back asynchronously, after the try/catch around this function has
      // left the stack, so the continuation is guarded on its own.
      try {
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
            seriesAsync(collection, check, all, index + 1, cb, onError);
          });
        } else {
          seriesAsync(collection, check, all, index + 1, cb, onError);
        }
      } catch (err) {
        onError(err);
      }
    });
  } catch (err) {
    onError(err);
  }
}

/**
 * Iterate a collection in series awaiting each check operation.
 * @param collection The collection to iterate.
 * @param check The check to perform for each item in the container.
 * @param cb Called with true if all items pass the check.
 * @param onError Called instead of cb if a check or cb throws.
 */
export function allSeriesAsync<T>(
  collection: T[] | undefined,
  check: (val: T, index: number, cb: (res: boolean) => void) => void,
  cb: (res: boolean) => void,
  onError: IterationErrorHandler,
): void {
  seriesAsync(collection, check, true, 0, cb, onError);
}

/**
 * Iterate a collection in series awaiting each check operation.
 * @param collection The collection to iterate.
 * @param check The check to perform for each item in the container.
 * @param cb called with true on the first item that passes the check. False
 * means no items passed the check.
 * @param onError Called instead of cb if a check or cb throws.
 */
export function firstSeriesAsync<T>(
  collection: T[] | undefined,
  check: (val: T, index: number, cb: (res: boolean) => void) => void,
  cb: (res: boolean) => void,
  onError: IterationErrorHandler,
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
 * @param onError Called instead of cb if a check or cb throws.
 */
export function allAsync<T>(
  collection: T[] | undefined,
  check: (val: T, cb: (res: boolean) => void) => void,
  cb: (res: boolean | null | undefined) => void,
  onError: IterationErrorHandler,
): void {
  try {
    if (!collection) {
      cb(false);
      return;
    }

    Promise.all(
      collection.map(
        (item) =>
          new Promise((resolve) => {
            check(item, resolve);
          }),
      ),
    )
      .then((results) => {
        cb(results.every((success) => success));
      })
      // A throw inside a check rejects its promise, and a throw inside cb rejects the chain.
      // Without this handler either one would be an unhandled rejection and cb would never run.
      .catch(onError);
  } catch (err) {
    onError(err);
  }
}
