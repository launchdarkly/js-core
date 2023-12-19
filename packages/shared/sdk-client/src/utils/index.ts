import { fastDeepEqual } from '@launchdarkly/js-sdk-common';

import { Flags } from '../types';

// eslint-disable-next-line import/prefer-default-export
export function calculateFlagChanges(flags: Flags, incomingFlags: Flags) {
  const changedKeys: string[] = [];

  // flag deleted or updated
  Object.entries(flags).forEach(([k, f]) => {
    const incoming = incomingFlags[k];
    if (!incoming || !fastDeepEqual(f, incoming)) {
      changedKeys.push(k);
    }
  });

  // flag added
  Object.keys(incomingFlags).forEach((k) => {
    if (!flags[k]) {
      changedKeys.push(k);
    }
  });

  return changedKeys;
}
