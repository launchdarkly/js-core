import { fastDeepEqual } from '@launchdarkly/js-sdk-common';

import { LDEvaluationResultsMap } from '../types';

// eslint-disable-next-line import/prefer-default-export
export default function calculateFlagChanges(flags: LDEvaluationResultsMap, incomingFlags: LDEvaluationResultsMap) {
  const changedKeys: string[] = [];

  // flag deleted or updated
  Object.entries(flags).forEach(([k, f]) => {
    const incoming = incomingFlags.get(k);
    if (!incoming || !fastDeepEqual(f, incoming)) {
      changedKeys.push(k);
    }
  });

  // flag added
  Object.keys(incomingFlags).forEach((k) => {
    if (!flags.get(k)) {
      changedKeys.push(k);
    }
  });

  return changedKeys;
}
