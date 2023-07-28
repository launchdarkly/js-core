import { BigSegmentStoreMembership } from '../api/interfaces';
import { Flag } from './data/Flag';
import { Segment } from './data/Segment';

/**
 * This interface is used by the evaluator to query data it may need during
 * an evaluation.
 *
 * @internal
 */
export interface Queries {
  getFlag(key: string): Promise<Flag | undefined>;
  getSegment(key: string): Promise<Segment | undefined>;
  getBigSegmentsMembership(
    userKey: string,
  ): Promise<[BigSegmentStoreMembership | null, string] | undefined>;
}
