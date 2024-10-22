/**
 * Wrap a promise to invoke an optional callback upon resolution or rejection.
 *
 * This function assumes the callback follows the Node.js callback type: (err, value) => void
 *
 * If a callback is provided:
 *   - if the promise is resolved, invoke the callback with (null, value)
 *   - if the promise is rejected, invoke the callback with (error, null)
 *
 * @param {Promise<any>} promise
 * @param {Function} callback
 * @returns Promise<any> | undefined
 */
export function wrapPromiseCallback<T>(
  promise: Promise<T>,
  callback?: (err: Error | null, res: T | null) => void,
): Promise<T | undefined> | undefined {
  const ret = promise.then(
    (value) => {
      if (callback) {
        setTimeout(() => {
          callback(null, value);
        }, 0);
      }
      return value;
    },
    (error) => {
      if (callback) {
        setTimeout(() => {
          callback(error, null);
        }, 0);
      } else {
        return Promise.reject(error);
      }
      return undefined;
    },
  );

  return !callback ? ret : undefined;
}
