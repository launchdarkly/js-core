// The deserialization will be updating parameter values, so we don't need this
// warning in this file.
/* eslint-disable no-param-reassign */
import AttributeReference from '@launchdarkly/js-sdk-common/dist/AttributeReference';
import { Flag } from '../evaluation/data/Flag';
import { Segment } from '../evaluation/data/Segment';
import { VersionedData } from '../api/interfaces';
import VersionedDataKinds from './VersionedDataKinds';
import { Rollout } from '../evaluation/data/Rollout';

/**
 * @internal
 */
export function reviver(this: any, key: string, value: any): any {
  // Whenever a null is included we want to remove the field.
  // In this way validation checks do not have to consider null, only undefined.
  if (value === null) {
    return undefined;
  }

  return value;
}

interface AllData {
  data: {
    flags: { [name: string]: Flag }
    segments: { [name: string]: Segment }
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
  return value;
}

interface DeleteData extends Omit<VersionedData, 'key'> {
  path: string;
}

type VersionedFlag = VersionedData & Flag;
type VersionedSegment = VersionedData & Segment;

interface PatchData {
  path: string;
  data: VersionedFlag | VersionedSegment
}

function processRollout(rollout?: Rollout) {
  if (rollout && rollout.bucketBy) {
    rollout.bucketByAttributeReference = new AttributeReference(
      rollout.bucketBy,
      !!rollout.contextKind,
    );
  }
}

function processFlag(flag: Flag) {
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
      }
    });
  });
}

function processSegment(segment: Segment) {
  if (segment.bucketBy) {
    // Rules before U2C would have had literals for attributes.
    // So use the rolloutContextKind to indicate if this is new or old data.
    segment.bucketByAttributeReference = new AttributeReference(
      segment.bucketBy,
      !segment.rolloutContextKind,
    );
  }
  segment?.rules?.forEach((rule) => {
    rule?.clauses?.forEach((clause) => {
      if (clause && clause.attribute) {
        // Clauses before U2C would have had literals for attributes.
        // So use the contextKind to indicate if this is new or old data.
        clause.attributeReference = new AttributeReference(clause.attribute, !clause.contextKind);
      }
    });
  });
}

function tryParse(data: string): any {
  try {
    return JSON.parse(data, reviver);
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

  // TODO: Extend validation.

  Object.values(parsed?.data?.flags || []).forEach((flag) => {
    processFlag(flag);
  });

  Object.values(parsed?.data?.segments || []).forEach((segment) => {
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

  // TODO: Extend validation.
  // TODO: Validate variation is numeric?

  if (parsed.path.startsWith(VersionedDataKinds.Features.streamApiPath)) {
    processFlag(parsed.data as VersionedFlag);
  } else if (parsed.path.startsWith(VersionedDataKinds.Segments.streamApiPath)) {
    processSegment(parsed.data as VersionedSegment);
  }

  return parsed;
}

/**
 * @internal
 */
export function deserializeDelete(data: string): DeleteData | undefined {
  return tryParse(data);
}
