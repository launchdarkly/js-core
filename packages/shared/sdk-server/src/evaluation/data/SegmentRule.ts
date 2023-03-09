import { AttributeReference } from '@launchdarkly/js-sdk-common';
import { Clause } from './Clause';

export interface SegmentRule {
  id: string;
  clauses: Clause[];
  weight?: number;

  bucketBy?: string;
  rolloutContextKind?: string;

  // This field is not part of the schema, but it is populated during parsing.
  bucketByAttributeReference?: AttributeReference;
}
