import { ClientSideAvailability } from './ClientSideAvailability';
import { Prerequisite } from './Prerequisite';
import { Rollout } from './Rollout';
import { FlagRule } from './FlagRule';
import { Target } from './Target';
import { Versioned } from './Versioned';

type VariationOrRollout = { variation: number; } | { rollout: Rollout };

export interface Flag extends Versioned {
  on: boolean,
  prerequisites?: Prerequisite[];
  targets?: Omit<Target, 'contextKind'>[],
  contextTargets?: Target[],
  rules?: FlagRule[],
  fallthrough: VariationOrRollout,
  offVariation?: number;
  variations: any[];
  clientSide?: boolean;
  clientSideAvailability?: ClientSideAvailability;
  salt?: string;
  trackEvents?: boolean;
  trackEventsFallthrough?: boolean;
  debugEventsUntilDate?: number
}
