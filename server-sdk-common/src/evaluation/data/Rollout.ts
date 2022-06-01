import { WeightedVariation } from './WeightedVariation';

type RolloutKind = 'rollout' | 'experiment';
export interface Rollout {
  kind?: RolloutKind,
  bucketBy?: string,
  variations: WeightedVariation[]
  seed?: number
}
