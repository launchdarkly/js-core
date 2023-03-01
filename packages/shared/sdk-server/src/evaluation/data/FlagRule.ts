import { Clause } from './Clause';
import { Rollout } from './Rollout';
import { VariationOrRollout } from './VariationOrRollout';

export interface FlagRule extends VariationOrRollout {
  id: string;
  variation?: number;
  rollout?: Rollout;
  trackEvents?: boolean;
  clauses?: Clause[];
}
