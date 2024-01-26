import isEmptyObject from './isEmptyObject';

/**
 * Strips all falsy and empty {} from a given object. Returns a new object with only truthy values.
 * Sourced from below but modified to include checks for empty object and ignoring keys.
 * https://www.w3resource.com/javascript-exercises/javascript-array-exercise-47.php
 *
 * @param obj
 * @param ignoreKeys
 */
const deepCompact = <T extends Object>(obj?: T, ignoreKeys?: string[]) => {
  if (!obj) {
    return obj;
  }

  return Object.entries(obj).reduce((acc: any, [key, value]) => {
    if (Boolean(value) && !isEmptyObject(value) && !ignoreKeys?.includes(key)) {
      acc[key] = typeof value === 'object' ? deepCompact(value, ignoreKeys) : value;
    }
    return acc;
  }, {}) as T;
};

export default deepCompact;
