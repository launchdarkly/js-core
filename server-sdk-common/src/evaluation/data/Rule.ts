import { Clause } from './Clause';
import { Rollout } from './Rollout';

export interface Rule {
  id: string;
  variation?: number;
  rollout?: Rollout;
  trackEvents: boolean;
  clauses: Clause[];
}
