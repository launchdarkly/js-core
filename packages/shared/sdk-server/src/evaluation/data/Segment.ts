import { AttributeReference } from '@launchdarkly/js-sdk-common';

import { SegmentRule } from './SegmentRule';
import { SegmentTarget } from './SegmentTarget';
import { Versioned } from './Versioned';

export interface Segment extends Versioned {
  included?: string[];
  excluded?: string[];

  includedContexts?: SegmentTarget[];
  excludedContexts?: SegmentTarget[];
  rules?: SegmentRule[];
  salt?: string;
  unbounded?: boolean;
  unboundedContextKind?: string;
  generation?: number;

  // This field is not part of the schema, but it is populated during parsing.
  bucketByAttributeReference?: AttributeReference;

  // When there are a large number targets for a segment then
  // we put them into sets during de-serialization.
  generated_includedSet?: Set<string>;
  generated_excludedSet?: Set<string>;

  /**
   * True when this definition was supplied by an override source rather than by LaunchDarkly.
   *
   * This field is not part of the data model and is never serialized. Only the SDK's override
   * store sets it, on the entries it holds. Evaluation reads it to mark the evaluations that read
   * the definition. Other readers can treat a marked definition the same as any other.
   *
   * Flag overrides are currently experimental and subject to change.
   */
  _sdk_override?: boolean;
}
