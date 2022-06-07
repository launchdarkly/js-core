import AttributeReference from '@launchdarkly/js-sdk-common/dist/AttributeReference';
import { WeightedVariation } from './WeightedVariation';

type RolloutKind = 'rollout' | 'experiment';
export interface Rollout {
  kind?: RolloutKind,
  contextKind?: string,
  bucketBy?: string,
  variations: WeightedVariation[]
  seed?: number

  // This field is not part of the schema, but it is populated during parsing.
  bucketByAttributeReference?: AttributeReference
}
