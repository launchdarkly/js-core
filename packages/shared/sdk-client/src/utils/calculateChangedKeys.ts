import { fastDeepEqual } from '@launchdarkly/js-sdk-common';

// eslint-disable-next-line import/prefer-default-export
export default function calculateChangedKeys(
  existingObject: { [k: string]: any },
  newObject: { [k: string]: any },
) {
  const changedKeys: string[] = [];

  // flag deleted or updated
  Object.entries(existingObject).forEach(([k, f]) => {
    const subObject = newObject[k];
    if (!subObject || !fastDeepEqual(f, subObject)) {
      changedKeys.push(k);
    }
  });

  // flag added
  Object.keys(newObject).forEach((k) => {
    if (!existingObject[k]) {
      changedKeys.push(k);
    }
  });

  return changedKeys;
}
