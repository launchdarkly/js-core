// The deserialization will be updating parameter values, so we don't need this
// warning in this file.

/* eslint-disable no-param-reassign */
import { AttributeReference } from '@launchdarkly/js-sdk-common';

import { VersionedData } from '../api/interfaces';
import { Flag } from '../evaluation/data/Flag';
import { Rollout } from '../evaluation/data/Rollout';
import { Segment } from '../evaluation/data/Segment';
import VersionedDataKinds, { VersionedDataKind } from './VersionedDataKinds';

// The max size where we use an array instead of a set.
const TARGET_LIST_ARRAY_CUTOFF = 100;

export interface FlagsAndSegments {
  flags: { [name: string]: Flag };
  segments: { [name: string]: Segment };
}

export interface AllData {
  data: FlagsAndSegments;
}

/**
 * Performs deep removal of null values.
 *
 * Does not remove null values from arrays.
 *
 * Note: This is a non-recursive implementation for performance and to avoid
 * potential stack overflows.
 *
 * @param target The target to remove null values from.
 * @param excludeKeys A list of top-level keys to exclude from null removal.
 */
export function nullReplacer(target: any, excludeKeys?: string[]): void {
  const stack: {
    key: string;
    value: any;
    parent: any;
  }[] = [];

  if (target === null || target === undefined) {
    return;
  }

  const filteredEntries = Object.entries(target).filter(
    ([key, _value]) => !excludeKeys?.includes(key),
  );

  stack.push(
    ...filteredEntries.map(([key, value]) => ({
      key,
      value,
      parent: target,
    })),
  );

  while (stack.length) {
    const item = stack.pop()!;
    // Do not remove items from arrays.
    if (item.value === null && !Array.isArray(item.parent)) {
      delete item.parent[item.key];
    } else if (typeof item.value === 'object' && item.value !== null) {
      // Add all the children to the stack. This includes array children.
      // The items in the array could themselves be objects which need nulls
      // removed from them.
      stack.push(
        ...Object.entries(item.value).map(([key, value]) => ({
          key,
          value,
          parent: item.value,
        })),
      );
    }
  }
}

/**
 * For use when serializing flags/segments. This will ensure local types
 * are converted to the appropriate JSON representation.
 * @param this The scope containing the key/value.
 * @param key The key of the item being visited.
 * @param value The value of the item being visited.
 * @returns A transformed value for serialization.
 *
 * @internal
 */
export function replacer(this: any, key: string, value: any): any {
  if (value instanceof AttributeReference) {
    return undefined;
  }
  if (Array.isArray(value)) {
    if (value[0] && value[0] instanceof AttributeReference) {
      return undefined;
    }
  }
  // Allow null/undefined values to pass through without modification.
  if (value === null || value === undefined) {
    return value;
  }
  if (value.generated_includedSet) {
    value.included = [...value.generated_includedSet];
    delete value.generated_includedSet;
  }
  if (value.generated_excludedSet) {
    value.excluded = [...value.generated_excludedSet];
    delete value.generated_excludedSet;
  }
  if (value.includedContexts) {
    value.includedContexts.forEach((target: any) => {
      if (target.generated_valuesSet) {
        target.values = [...target.generated_valuesSet];
      }
      delete target.generated_valuesSet;
    });
  }
  if (value.excludedContexts) {
    value.excludedContexts.forEach((target: any) => {
      if (target.generated_valuesSet) {
        target.values = [...target.generated_valuesSet];
      }
      delete target.generated_valuesSet;
    });
  }
  return value;
}

export interface DeleteData extends Omit<VersionedData, 'key'> {
  path: string;
  kind?: VersionedDataKind;
}

type VersionedFlag = VersionedData & Flag;
type VersionedSegment = VersionedData & Segment;

export interface PatchData {
  path: string;
  data: VersionedFlag | VersionedSegment;
  kind?: VersionedDataKind;
}

function processRollout(rollout?: Rollout) {
  if (rollout && rollout.bucketBy) {
    rollout.bucketByAttributeReference = new AttributeReference(
      rollout.bucketBy,
      !rollout.contextKind,
    );
  }
}

/**
 * @internal
 */
export function processFlag(flag: Flag) {
  nullReplacer(flag, ['variations']);

  if (flag.fallthrough && flag.fallthrough.rollout) {
    const rollout = flag.fallthrough.rollout!;
    processRollout(rollout);
  }
  flag?.rules?.forEach((rule) => {
    processRollout(rule.rollout);

    rule?.clauses?.forEach((clause) => {
      if (clause && clause.attribute) {
        // Clauses before U2C would have had literals for attributes.
        // So use the contextKind to indicate if this is new or old data.
        clause.attributeReference = new AttributeReference(clause.attribute, !clause.contextKind);
      } else if (clause) {
        clause.attributeReference = AttributeReference.InvalidReference;
      }
    });
  });
}

/**
 * @internal
 */
export function processSegment(segment: Segment) {
  nullReplacer(segment);
  if (segment?.included?.length && segment.included.length > TARGET_LIST_ARRAY_CUTOFF) {
    segment.generated_includedSet = new Set(segment.included);
    delete segment.included;
  }
  if (segment?.excluded?.length && segment.excluded.length > TARGET_LIST_ARRAY_CUTOFF) {
    segment.generated_excludedSet = new Set(segment.excluded);
    delete segment.excluded;
  }

  if (segment?.includedContexts?.length) {
    segment.includedContexts.forEach((target) => {
      if (target?.values?.length && target.values.length > TARGET_LIST_ARRAY_CUTOFF) {
        target.generated_valuesSet = new Set(target.values);
        // Currently typing is non-optional, so we don't delete it.
        target.values = [];
      }
    });
  }

  if (segment?.excludedContexts?.length) {
    segment.excludedContexts.forEach((target) => {
      if (target?.values?.length && target.values.length > TARGET_LIST_ARRAY_CUTOFF) {
        target.generated_valuesSet = new Set(target.values);
        // Currently typing is non-optional, so we don't delete it.
        target.values = [];
      }
    });
  }

  segment?.rules?.forEach((rule) => {
    if (rule.bucketBy) {
      // Rules before U2C would have had literals for attributes.
      // So use the rolloutContextKind to indicate if this is new or old data.
      rule.bucketByAttributeReference = new AttributeReference(
        rule.bucketBy,
        !rule.rolloutContextKind,
      );
    }
    rule?.clauses?.forEach((clause) => {
      if (clause && clause.attribute) {
        // Clauses before U2C would have had literals for attributes.
        // So use the contextKind to indicate if this is new or old data.
        clause.attributeReference = new AttributeReference(clause.attribute, !clause.contextKind);
      } else if (clause) {
        clause.attributeReference = AttributeReference.InvalidReference;
      }
    });
  });
}

function tryParse(data: string): any {
  try {
    return JSON.parse(data);
  } catch {
    return undefined;
  }
}

/**
 * @internal
 */
export function deserializeAll(data: string): AllData | undefined {
  // The reviver lacks the context of where a different key exists, being as it
  // starts at the deepest level and works outward. As a result attributes are
  // translated into references after the initial parsing. That way we can be sure
  // they are the correct ones. For instance if we added 'attribute' as a new field to
  // the schema for something that was NOT an attribute reference, then we wouldn't
  // want to construct an attribute reference out of it.
  const parsed = tryParse(data) as AllData;

  if (!parsed) {
    return undefined;
  }

  Object.values(parsed?.data?.flags || []).forEach((flag) => {
    processFlag(flag);
  });

  Object.values(parsed?.data?.segments || []).forEach((segment) => {
    processSegment(segment);
  });
  return parsed;
}

/**
 * This function is intended for usage inside LaunchDarkly SDKs.
 * This function should NOT be used by customer applications.
 * This function may be changed or removed without a major version.
 *
 * @param data String data from launchdarkly.
 * @returns The parsed and processed data.
 */
export function deserializePoll(data: string): FlagsAndSegments | undefined {
  const parsed = tryParse(data) as FlagsAndSegments;

  if (!parsed) {
    return undefined;
  }

  Object.values(parsed?.flags || []).forEach((flag) => {
    processFlag(flag);
  });

  Object.values(parsed?.segments || []).forEach((segment) => {
    processSegment(segment);
  });
  return parsed;
}

/**
 * @internal
 */
export function deserializePatch(data: string): PatchData | undefined {
  const parsed = tryParse(data) as PatchData;

  if (!parsed) {
    return undefined;
  }

  if (parsed.path.startsWith(VersionedDataKinds.Features.streamApiPath)) {
    processFlag(parsed.data as VersionedFlag);
    parsed.kind = VersionedDataKinds.Features;
  } else if (parsed.path.startsWith(VersionedDataKinds.Segments.streamApiPath)) {
    processSegment(parsed.data as VersionedSegment);
    parsed.kind = VersionedDataKinds.Segments;
  }

  return parsed;
}

/**
 * @internal
 */
export function deserializeDelete(data: string): DeleteData | undefined {
  const parsed = tryParse(data) as DeleteData;
  if (!parsed) {
    return undefined;
  }
  if (parsed.path.startsWith(VersionedDataKinds.Features.streamApiPath)) {
    parsed.kind = VersionedDataKinds.Features;
  } else if (parsed.path.startsWith(VersionedDataKinds.Segments.streamApiPath)) {
    parsed.kind = VersionedDataKinds.Segments;
  }
  return parsed;
}

/**
 * Serialize a single flag. Used for persistent data stores.
 *
 * @internal
 */
export function serializeFlag(flag: Flag): string {
  return JSON.stringify(flag, replacer);
}

/**
 * Deserialize a single flag. Used for persistent data stores.
 *
 * @internal
 */
export function deserializeFlag(data: string): Flag | undefined {
  const parsed = tryParse(data);
  if (!parsed) {
    return undefined;
  }

  processFlag(parsed);
  return parsed;
}

/**
 * Serialize a single segment. Used for persistent data stores.
 *
 * @internal
 */
export function serializeSegment(segment: Segment): string {
  return JSON.stringify(segment, replacer);
}

/**
 * Deserialize a single segment. Used for persistent data stores.
 *
 * @internal
 */
export function deserializeSegment(data: string): Segment | undefined {
  const parsed = tryParse(data);
  if (!parsed) {
    return undefined;
  }

  processSegment(parsed);
  return parsed;
}
