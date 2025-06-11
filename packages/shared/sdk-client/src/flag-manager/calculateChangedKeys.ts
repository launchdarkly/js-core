import { fastDeepEqual } from '@launchdarkly/js-sdk-common';

export default function calculateChangedKeys(
  existingObject: { [k: string]: any },
  newObject: { [k: string]: any },
): string[] {
  const changedKeys: string[] = [];

  // property deleted or updated
  Object.entries(existingObject).forEach(([k, f]) => {
    const subObject = newObject[k];
    if (!subObject || !fastDeepEqual(f, subObject)) {
      changedKeys.push(k);
    }
  });

  // property added
  Object.keys(newObject).forEach((k) => {
    if (!existingObject[k]) {
      changedKeys.push(k);
    }
  });

  return changedKeys;
}
