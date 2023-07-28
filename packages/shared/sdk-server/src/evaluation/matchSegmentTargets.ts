import { Context } from '@launchdarkly/js-sdk-common';

import { Segment } from './data/Segment';
import { SegmentTarget } from './data/SegmentTarget';

function segmentSearch(
  context: Context,
  contextTargets?: SegmentTarget[],
  userTargets?: string[],
): boolean {
  if (contextTargets) {
    for (let targetIndex = 0; targetIndex < contextTargets.length; targetIndex += 1) {
      const target = contextTargets[targetIndex];
      const key = context.key(target.contextKind);
      if (key && target.values.includes(key)) {
        return true;
      }
    }
  }

  if (userTargets) {
    const userKey = context.key('user');
    if (userKey) {
      if (userTargets.includes(userKey)) {
        return true;
      }
    }
  }
  return false;
}

export default function matchSegmentTargets(
  segment: Segment,
  context: Context,
): boolean | undefined {
  const included = segmentSearch(context, segment.includedContexts, segment.included);
  if (included) {
    return true;
  }
  const excluded = segmentSearch(context, segment.excludedContexts, segment.excluded);
  if (excluded) {
    // The match was an exclusion, so it should be negated.
    return !excluded;
  }
  return undefined;
}
