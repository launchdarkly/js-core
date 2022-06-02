import { Clause } from './Clause';
import { Rollout } from './Rollout';

export interface FlagRule {
  id: string;
  variation?: number;
  rollout?: Rollout;
  trackEvents?: boolean;
  clauses?: Clause[];
}
