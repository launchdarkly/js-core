import { ClientSideAvailability } from './ClientSideAvailability';
import { FlagRule } from './FlagRule';
import { Prerequisite } from './Prerequisite';
import { Rollout } from './Rollout';
import { Target } from './Target';
import { Versioned } from './Versioned';

interface VariationOrRollout {
  variation?: number;
  rollout?: Rollout;
}

export interface Flag extends Versioned {
  on: boolean;
  prerequisites?: Prerequisite[];
  targets?: Omit<Target, 'contextKind'>[];
  contextTargets?: Target[];
  rules?: FlagRule[];
  fallthrough: VariationOrRollout;
  offVariation?: number;
  variations: any[];
  clientSide?: boolean;
  clientSideAvailability?: ClientSideAvailability;
  salt?: string;
  trackEvents?: boolean;
  trackEventsFallthrough?: boolean;
  debugEventsUntilDate?: number;
  excludeFromSummaries?: boolean;
  samplingRatio?: number;
  migration?: {
    checkRatio?: number;
  };

  /**
   * True when this definition was supplied by an override source rather than by LaunchDarkly.
   *
   * This field is not part of the data model and is never serialized. Only the SDK's override
   * store sets it, on the entries it holds. Evaluation reads it to mark the evaluations that read
   * the definition. Other readers can treat a marked definition the same as any other.
   *
   * Flag overrides are currently experimental and subject to change.
   */
  _sdk_override?: boolean;
}
