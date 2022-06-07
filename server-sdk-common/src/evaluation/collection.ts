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
  operator: (val: T) => U | undefined,
): U | undefined {
  let res;
  collection?.some((item) => {
    res = operator(item);
    return !!res;
  });
  return res;
}

/**
 * Iterate a collection in series awaiting each check operation.
 * @param collection The collection to iterate.
 * @param check The check to perform for each item in the container.
 * @returns True if all items pass the check.
 */
export async function allSeriesAsync<T>(
  collection: T[] | undefined,
  check: (val: T) => Promise<boolean>,
): Promise<boolean> {
  if (!collection) {
    return false;
  }
  for (let index = 0; index < collection.length; index += 1) {
    // This warning is to encourage starting many operations at once.
    // In this case we only want to evaluate until we encounter something that
    // doesn't match. Versus starting all the evaluations and then letting them
    // all resolve.
    // eslint-disable-next-line no-await-in-loop
    const res = await check(collection[index]);
    if (!res) {
      return false;
    }
  }
  return true;
}
