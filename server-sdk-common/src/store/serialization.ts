// The deserialization will be updating parameter values, so we don't need this
// warning in this file.
/* eslint-disable no-param-reassign */
import AttributeReference from '@launchdarkly/js-sdk-common/dist/AttributeReference';
import { Flag } from '../evaluation/data/Flag';
import { Segment } from '../evaluation/data/Segment';
import { VersionedData } from '../api/interfaces';
import VersionedDataKinds from './VersionedDataKinds';

function reviver(this: any, key: string, value: any): any {
  // Whenever a null is included we want to remove the field.
  // In this way validation checks do not have to consider null, only undefined.
  if (value === null) {
    return undefined;
  }

  return value;
}

interface AllData {
  flags: { [name: string]: Flag }
  segments: { [name: string]: Segment }
}

interface DeleteData extends VersionedData {
  path: string;
}

type VersionedFlag = VersionedData & Flag;
type VersionedSegment = VersionedData & Segment;

interface PatchData {
  path: string;
  data: VersionedFlag | VersionedSegment
}

function processFlag(flag: Flag) {
  flag?.rules?.forEach((rule) => {
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
  segment?.rules?.forEach((rule) => {
    if (rule.bucketBy) {
      // Rules before U2C would have had literals for attributes.
      // So use the rolloutContextKind to indicate if this is new or old data.
      rule.bucketByAttributeReference = new AttributeReference(
        rule.bucketBy,
        !rule.rolloutContextKind,
      );
    }
  });
}

export function deserializeAll(data: string): AllData {
  // The reviver lacks the context of where a different key exists, being as it
  // starts at the deepest level and works outward. As a result attributes are
  // translated into references after the initial parsing. That way we can be sure
  // they are the correct ones. For instance if we added 'attribute' as a new field to
  // the schema for something that was NOT an attribute reference, then we wouldn't
  // want to construct an attribute reference out of it.
  const parsed = JSON.parse(data, reviver) as AllData;
  Object.values(parsed.flags).forEach((flag) => {
    processFlag(flag);
  });

  Object.values(parsed.segments).forEach((segment) => {
    processSegment(segment);
  });
  return parsed;
}

export function deserializePatch(data: string): PatchData {
  const parsed = JSON.parse(data, reviver) as PatchData;

  if (parsed.path.startsWith(VersionedDataKinds.Features.streamApiPath)) {
    processFlag(parsed.data as VersionedFlag);
  }

  if (parsed.path.startsWith(VersionedDataKinds.Segments.streamApiPath)) {
    processSegment(parsed.data as VersionedSegment);
  }

  return parsed;
}

export function deserializeDelete(data: string): DeleteData {
  return JSON.parse(data, reviver);
}

// TODO: Remove attribute reference types during serialization.
