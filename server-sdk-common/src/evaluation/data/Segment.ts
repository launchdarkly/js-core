import { SegmentTarget } from './SegmentTarget';
import { Versioned } from './Versioned';
import { SegmentRule } from './SegmentRule';

export interface Segment extends Versioned {
  included?: string[],
  excluded?: string[],
  includedContexts?: SegmentTarget[];
  excludedContexts?: SegmentTarget[];
  rules?: SegmentRule[];
  salt?: string;
  unbounded?: boolean;
  unboundedContextKind?: string;
  generation?: number;
}
