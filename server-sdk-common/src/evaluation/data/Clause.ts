import { AttributeReference } from '@launchdarkly/js-sdk-common';

export type Op =
  'in'
  | 'startsWith'
  | 'endsWith'
  | 'contains'
  | 'matches'
  | 'lessThan'
  | 'lessThanOrEqual'
  | 'greaterThan'
  | 'greaterThanOrEqual'
  | 'before'
  | 'after'
  | 'segmentMatch'
  | 'semVerEqual'
  | 'semVerGreaterThan'
  | 'semVerLessThan';

export interface Clause {
  attribute: string,
  negate?: boolean,
  op: Op,
  values: any[];
  contextKind?: string;

  // This field is not part of the schema, but it is populated during parsing.
  attributeReference: AttributeReference
}
