import { BigSegmentStoreMembership } from '../api/interfaces';
import { Flag } from './data/Flag';
import { Segment } from './data/Segment';

/**
 * This interface is used by the evaluator to query data it may need during
 * an evaluation.
 */
export interface Queries {
  getFlag(key: string): Promise<Flag | null>
  getSegment(key: string): Promise<Segment | null>
  getBigSegmentsMembership(userKey: string): Promise<BigSegmentStoreMembership | null>
}
