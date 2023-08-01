// The deserialization will be updating parameter values, so we don't need this
// warning in this file.

/* eslint-disable no-param-reassign */
import { AttributeReference } from '@launchdarkly/js-sdk-common';

import { VersionedData } from '../api/interfaces';
import { Flag } from '../evaluation/data/Flag';
import { Rollout } from '../evaluation/data/Rollout';
import { Segment } from '../evaluation/data/Segment';
import { Metric } from './Metric';
import { Override } from './Override';
import VersionedDataKinds, { VersionedDataKind } from './VersionedDataKinds';

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
  flags: { [name: string]: Flag };
  segments: { [name: string]: Segment };
  configurationOverrides?: { [name: string]: Override };
  metrics?: { [name: string]: Metric };
}

interface AllDataStream {
  data: AllData;
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
  return value;
}

interface DeleteData extends Omit<VersionedData, 'key'> {
  path: string;
  kind?: VersionedDataKind;
}

type VersionedFlag = VersionedData & Flag;
type VersionedSegment = VersionedData & Segment;

interface PatchData {
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
        clause.attributeReference = AttributeReference.invalidReference;
      }
    });
  });
}

/**
 * @internal
 */
export function processSegment(segment: Segment) {
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
        clause.attributeReference = AttributeReference.invalidReference;
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
export function deserializeAll(data: string): AllDataStream | undefined {
  // The reviver lacks the context of where a different key exists, being as it
  // starts at the deepest level and works outward. As a result attributes are
  // translated into references after the initial parsing. That way we can be sure
  // they are the correct ones. For instance if we added 'attribute' as a new field to
  // the schema for something that was NOT an attribute reference, then we wouldn't
  // want to construct an attribute reference out of it.
  const parsed = tryParse(data) as AllDataStream;

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
export function deserializePoll(data: string): AllData | undefined {
  const parsed = tryParse(data) as AllData;

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
