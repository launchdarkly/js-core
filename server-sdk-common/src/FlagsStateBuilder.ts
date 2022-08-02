import { LDEvaluationReason, LDFlagSet, LDFlagsState } from './api';
import { Flag } from './evaluation/data/Flag';

interface FlagMeta {
  variation?: number,
  version?: number,
  reason?: LDEvaluationReason,
  trackEvents?: boolean,
  trackReason?: boolean,
  debugEventsUntilDate?: number,
}

export default class FlagsStateBuilder {
  private flagValues: LDFlagSet = {};

  private flagMetadata: Record<string, FlagMeta> = {};

  constructor(private valid: boolean, private withReasons: boolean) {
  }

  addFlag(
    flag: Flag,
    value: any,
    variation: number | undefined,
    reason: LDEvaluationReason,
    trackEvents: boolean,
    trackReason: boolean,
    detailsOnlyIfTracked: boolean,
  ) {
    this.flagValues[flag.key] = value;
    const meta: FlagMeta = {};
    if (variation !== undefined) {
      meta.variation = variation;
    }
    const omitDetails = detailsOnlyIfTracked
      && !trackEvents
      && !trackReason
      && (flag.debugEventsUntilDate === undefined); // 0 probably doesn't matter.
    if (!omitDetails) {
      meta.version = flag.version;
    }
    if (reason && (trackReason || (this.withReasons && !omitDetails))) {
      meta.reason = reason;
    }
    if (trackEvents) {
      meta.trackEvents = true;
    }
    if (trackReason) {
      meta.trackReason = true;
    }
    if (flag.debugEventsUntilDate !== undefined) {
      meta.debugEventsUntilDate = flag.debugEventsUntilDate;
    }
    this.flagMetadata[flag.key] = meta;
  }

  build(): LDFlagsState {
    const state = this;
    return {
      valid: state.valid,
      allValues: () => state.flagValues,
      getFlagValue: (key) => state.flagValues[key],
      getFlagReason: (key) => (state.flagMetadata[key] ? state.flagMetadata[key].reason
        : null) ?? null,
      toJSON: () => ({
        ...state.flagValues,
        $flagsState: state.flagMetadata,
        $valid: state.valid,
      }),
    };
  }
}
