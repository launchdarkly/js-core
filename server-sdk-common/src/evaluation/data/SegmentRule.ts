import { Clause } from './Clause';

export interface SegmentRule {
  id: string;
  clauses: Clause[];
  weight?: number;
}
