import type { internal } from '@launchdarkly/js-sdk-common';

import { ItemDescriptor } from '../flag-manager/ItemDescriptor';
import { FlagEvaluationResult } from '../types';

/**
 * ObjProcessor for the `flagEval` object kind. Used by the protocol handler to
 * process objects received in `put-object` events.
 *
 * Client-side evaluation results are already in their final form (pre-evaluated
 * by the server), so no transformation is needed — this is a passthrough.
 */
export function processFlagEval(object: unknown): FlagEvaluationResult {
  return object as FlagEvaluationResult;
}

/**
 * Converts an FDv2 {@link internal.Update} with `kind: 'flagEval'` into an
 * {@link ItemDescriptor} suitable for {@link FlagManager}.
 *
 * For put updates the envelope `version` is used as the {@link ItemDescriptor.version}
 * and as {@link Flag.version}. The rest of the fields are spread from the
 * {@link FlagEvaluationResult} object.
 *
 * For delete updates a tombstone descriptor is created with `deleted: true`.
 */
export function flagEvalUpdateToItemDescriptor(update: internal.Update): ItemDescriptor {
  if (update.deleted) {
    return {
      version: update.version,
      flag: {
        version: update.version,
        deleted: true,
        value: undefined,
        trackEvents: false,
      },
    };
  }

  const evalResult = update.object as FlagEvaluationResult;
  return {
    version: update.version,
    flag: {
      ...evalResult,
      version: update.version,
    },
  };
}

/**
 * Converts an array of FDv2 payload updates into a map of flag key to
 * {@link ItemDescriptor}. Only `flagEval` kind updates are processed;
 * unrecognized kinds are silently ignored.
 */
export function flagEvalPayloadToItemDescriptors(updates: internal.Update[]): {
  [key: string]: ItemDescriptor;
} {
  const descriptors: { [key: string]: ItemDescriptor } = {};

  updates.forEach((update) => {
    if (update.kind === 'flagEval') {
      descriptors[update.key] = flagEvalUpdateToItemDescriptor(update);
    }
  });

  return descriptors;
}
