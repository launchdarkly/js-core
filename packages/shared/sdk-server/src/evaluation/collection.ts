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

function seriesAsync<T>(
  collection: T[] | undefined,
  check: (val: T, index: number, cb: (res: boolean) => void) => void,
  all: boolean,
  index: number,
  cb: (res: boolean) => void,
): void {
  if (!collection) {
    cb(false);
    return;
  }
  const item = collection[index];
  const resHandler = (res: boolean) => {
    if (all) {
      if (!res) {
        return cb(false);
      }
    } else if (res) {
      return cb(true);
    }
    const nextIndex = index + 1;
    if (nextIndex < collection?.length) {
      seriesAsync(collection, check, all, nextIndex, resHandler);
    }
    return cb(true);
  };
  check(item, index, resHandler);
}

/**
 * Iterate a collection in series awaiting each check operation.
 * @param collection The collection to iterate.
 * @param check The check to perform for each item in the container.
 * @returns True if all items pass the check.
 */
export function allSeriesAsync<T>(
  collection: T[] | undefined,
  check: (val: T, index: number, cb: (res: boolean) => void) => void,
  cb: (res: boolean) => void,
): void {
  seriesAsync(collection, check, true, 0, cb);
}

/**
 * Iterate a collection in series awaiting each check operation.
 * @param collection The collection to iterate.
 * @param check The check to perform for each item in the container.
 * @returns True on the first item that passes the check. False if no items
 * pass.
 */
export function firstSeriesAsync<T>(
  collection: T[] | undefined,
  check: (val: T, index: number, cb: (res: boolean) => void) => void,
  cb: (res: boolean) => void,
): void {
  seriesAsync(collection, check, false, 0, cb);
}
