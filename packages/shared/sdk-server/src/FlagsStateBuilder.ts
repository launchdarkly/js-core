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

// Sets an own property even for a key such as __proto__, where assignment (and object spread or
// Object.assign) would set the object's prototype instead.
function setOwnProperty(target: Record<string, any>, key: string, value: any) {
  Object.defineProperty(target, key, {
    value,
    writable: true,
    enumerable: true,
    configurable: true,
  });
}

export default class FlagsStateBuilder {
  // Both objects keep the normal prototype, because some callers accept only plain objects. For
  // example, React server components cannot pass a null-prototype object to a client component.
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
    debugEventsUntilDate: number | undefined,
    detailsOnlyIfTracked: boolean,
    prerequisites?: string[],
  ) {
    setOwnProperty(this._flagValues, flag.key, value);
    const meta: FlagMeta = {};
    if (variation !== undefined) {
      meta.variation = variation;
    }
    const omitDetails =
      detailsOnlyIfTracked && !trackEvents && !trackReason && debugEventsUntilDate === undefined; // 0 probably doesn't matter.
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
    if (debugEventsUntilDate !== undefined) {
      meta.debugEventsUntilDate = debugEventsUntilDate;
    }
    if (prerequisites && prerequisites.length) {
      meta.prerequisites = prerequisites;
    }
    setOwnProperty(this._flagMetadata, flag.key, meta);
  }

  build(): LDFlagsState {
    return {
      valid: this._valid,
      allValues: () => this._flagValues,
      getFlagValue: (key) =>
        Object.prototype.hasOwnProperty.call(this._flagValues, key)
          ? this._flagValues[key]
          : undefined,
      getFlagReason: (key) => this._flagMetadata[key]?.reason ?? null,
      toJSON: () => {
        const json: Record<string, any> = {};
        Object.keys(this._flagValues).forEach((key) =>
          setOwnProperty(json, key, this._flagValues[key]),
        );
        json.$flagsState = this._flagMetadata;
        json.$valid = this._valid;
        return json;
      },
    };
  }
}
