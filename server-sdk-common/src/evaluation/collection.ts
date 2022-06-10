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

async function seriesAsync<T>(
  collection: T[] | undefined,
  check: (val: T, index: number) => Promise<boolean>,
  all: boolean,
) {
  if (!collection) {
    return false;
  }
  for (let index = 0; index < collection.length; index += 1) {
    // This warning is to encourage starting many operations at once.
    // In this case we only want to evaluate until we encounter something that
    // doesn't match. Versus starting all the evaluations and then letting them
    // all resolve.
    // eslint-disable-next-line no-await-in-loop
    const res = await check(collection[index], index);
    // If we want all checks to pass, then we return on any failed check.
    // If we want only a single result to pass, then we return on a true result.
    if (all) {
      if (!res) {
        return false;
      }
    } else if (res) {
      return true;
    }
  }
  // In the case of 'all', getting here means all checks passed.
  // In the case of 'first', this means no checks passed.
  return all;
}

/**
 * Iterate a collection in series awaiting each check operation.
 * @param collection The collection to iterate.
 * @param check The check to perform for each item in the container.
 * @returns True if all items pass the check.
 */
export async function allSeriesAsync<T>(
  collection: T[] | undefined,
  check: (val: T, index: number) => Promise<boolean>,
): Promise<boolean> {
  return seriesAsync(collection, check, true);
}

/**
 * Iterate a collection in series awaiting each check operation.
 * @param collection The collection to iterate.
 * @param check The check to perform for each item in the container.
 * @returns True on the first item that passes the check. False if no items
 * pass.
 */
export async function firstSeriesAsync<T>(
  collection: T[] | undefined,
  check: (val: T, index: number) => Promise<boolean>,
): Promise<boolean> {
  return seriesAsync(collection, check, false);
}

function seriesSync<T>(
  collection: T[] | undefined,
  check: (val: T, index: number) => boolean,
  all: boolean,
) {
  if (!collection) {
    return false;
  }
  for (let index = 0; index < collection.length; index += 1) {
    // This warning is to encourage starting many operations at once.
    // In this case we only want to evaluate until we encounter something that
    // doesn't match. Versus starting all the evaluations and then letting them
    // all resolve.
    // eslint-disable-next-line no-await-in-loop
    const res = check(collection[index], index);
    // If we want all checks to pass, then we return on any failed check.
    // If we want only a single result to pass, then we return on a true result.
    if (all) {
      if (!res) {
        return false;
      }
    } else if (res) {
      return true;
    }
  }
  // In the case of 'all', getting here means all checks passed.
  // In the case of 'first', this means no checks passed.
  return all;
}

/**
 * Iterate a collection in series awaiting each check operation.
 * @param collection The collection to iterate.
 * @param check The check to perform for each item in the container.
 * @returns True if all items pass the check.
 */
export function allSeries<T>(
  collection: T[] | undefined,
  check: (val: T, index: number) => boolean,
): boolean {
  return seriesSync(collection, check, true);
}

/**
 * Iterate a collection in series awaiting each check operation.
 * @param collection The collection to iterate.
 * @param check The check to perform for each item in the container.
 * @returns True on the first item that passes the check. False if no items
 * pass.
 */
export function firstSeries<T>(
  collection: T[] | undefined,
  check: (val: T, index: number) => boolean,
): boolean {
  return seriesSync(collection, check, false);
}
