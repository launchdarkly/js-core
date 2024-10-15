import { LDEvaluationReason, LDFlagSet } from '@launchdarkly/js-sdk-common';

import { LDFlagsState } from './api/data/LDFlagsState';
import { Flag } from './evaluation/data/Flag';

interface FlagMeta {
  variation?: number;
  version?: number;
  reason?: LDEvaluationReason;
  trackEvents?: boolean;
  trackReason?: boolean;
  debugEventsUntilDate?: number;
  prerequisites?: string[];
}

export default class FlagsStateBuilder {
  private _flagValues: LDFlagSet = {};

  private _flagMetadata: Record<string, FlagMeta> = {};

  constructor(
    private _valid: boolean,
    private _withReasons: boolean,
  ) {}

  addFlag(
    flag: Flag,
    value: any,
    variation: number | undefined,
    reason: LDEvaluationReason,
    trackEvents: boolean,
    trackReason: boolean,
    detailsOnlyIfTracked: boolean,
    prerequisites?: string[],
  ) {
    this._flagValues[flag.key] = value;
    const meta: FlagMeta = {};
    if (variation !== undefined) {
      meta.variation = variation;
    }
    const omitDetails =
      detailsOnlyIfTracked &&
      !trackEvents &&
      !trackReason &&
      flag.debugEventsUntilDate === undefined; // 0 probably doesn't matter.
    if (!omitDetails) {
      meta.version = flag.version;
    }
    if (reason && (trackReason || (this._withReasons && !omitDetails))) {
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
    if (prerequisites && prerequisites.length) {
      meta.prerequisites = prerequisites;
    }
    this._flagMetadata[flag.key] = meta;
  }

  build(): LDFlagsState {
    return {
      valid: this._valid,
      allValues: () => this._flagValues,
      getFlagValue: (key) => this._flagValues[key],
      getFlagReason: (key) =>
        (this._flagMetadata[key] ? this._flagMetadata[key].reason : null) ?? null,
      toJSON: () => ({
        ...this._flagValues,
        $flagsState: this._flagMetadata,
        $valid: this._valid,
      }),
    };
  }
}
