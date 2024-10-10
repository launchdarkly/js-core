import {
  internal,
  LDEvaluationReason,
  LDLogger,
  TypeValidators,
} from '@launchdarkly/js-sdk-common';

import { LDMigrationStage, LDMigrationTracker } from './api';
import {
  LDConsistencyCheck,
  LDMigrationErrorMeasurement,
  LDMigrationInvokedMeasurement,
  LDMigrationMeasurement,
  LDMigrationOp,
  LDMigrationOpEvent,
} from './api/data';
import { LDMigrationOrigin } from './api/LDMigration';

function isPopulated(data: number): boolean {
  return !Number.isNaN(data);
}

export default class MigrationOpTracker implements LDMigrationTracker {
  private _errors = {
    old: false,
    new: false,
  };

  private _wasInvoked = {
    old: false,
    new: false,
  };

  private _consistencyCheck: LDConsistencyCheck = LDConsistencyCheck.NotChecked;

  private _latencyMeasurement = {
    old: NaN,
    new: NaN,
  };

  private _operation?: LDMigrationOp;

  constructor(
    private readonly _flagKey: string,
    private readonly _contextKeys: Record<string, string>,
    private readonly _defaultStage: LDMigrationStage,
    private readonly _stage: LDMigrationStage,
    private readonly _reason: LDEvaluationReason,
    private readonly _checkRatio?: number,
    private readonly _variation?: number,
    private readonly _version?: number,
    private readonly _samplingRatio?: number,
    private readonly _logger?: LDLogger,
  ) {}

  op(op: LDMigrationOp) {
    this._operation = op;
  }

  error(origin: LDMigrationOrigin) {
    this._errors[origin] = true;
  }

  consistency(check: () => boolean) {
    if (internal.shouldSample(this._checkRatio ?? 1)) {
      try {
        const res = check();
        this._consistencyCheck = res
          ? LDConsistencyCheck.Consistent
          : LDConsistencyCheck.Inconsistent;
      } catch (exception) {
        this._logger?.error(
          'Exception when executing consistency check function for migration' +
            ` '${this._flagKey}' the consistency check will not be included in the generated migration` +
            ` op event. Exception: ${exception}`,
        );
      }
    }
  }

  latency(origin: LDMigrationOrigin, value: number) {
    this._latencyMeasurement[origin] = value;
  }

  invoked(origin: LDMigrationOrigin) {
    this._wasInvoked[origin] = true;
  }

  createEvent(): LDMigrationOpEvent | undefined {
    if (!TypeValidators.String.is(this._flagKey) || this._flagKey === '') {
      this._logger?.error('The flag key for a migration operation must be a non-empty string.');
      return undefined;
    }

    if (!this._operation) {
      this._logger?.error('The operation must be set using "op" before an event can be created.');
      return undefined;
    }

    if (Object.keys(this._contextKeys).length === 0) {
      this._logger?.error(
        'The migration was not done against a valid context and cannot generate an event.',
      );
      return undefined;
    }

    if (!this._wasInvoked.old && !this._wasInvoked.new) {
      this._logger?.error(
        'The migration invoked neither the "old" or "new" implementation and' +
          'an event cannot be generated',
      );
      return undefined;
    }

    if (!this._measurementConsistencyCheck()) {
      return undefined;
    }

    const measurements: LDMigrationMeasurement[] = [];

    this._populateInvoked(measurements);
    this._populateConsistency(measurements);
    this._populateLatency(measurements);
    this._populateErrors(measurements);

    return {
      kind: 'migration_op',
      operation: this._operation,
      creationDate: Date.now(),
      contextKeys: this._contextKeys,
      evaluation: {
        key: this._flagKey,
        value: this._stage,
        default: this._defaultStage,
        reason: this._reason,
        variation: this._variation,
        version: this._version,
      },
      measurements,
      samplingRatio: this._samplingRatio ?? 1,
    };
  }

  private _logTag() {
    return `For migration ${this._operation}-${this._flagKey}:`;
  }

  private _latencyConsistencyMessage(origin: LDMigrationOrigin) {
    return `Latency measurement for "${origin}", but "${origin}" was not invoked.`;
  }

  private _errorConsistencyMessage(origin: LDMigrationOrigin) {
    return `Error occurred for "${origin}", but "${origin}" was not invoked.`;
  }

  private _consistencyCheckConsistencyMessage(origin: LDMigrationOrigin) {
    return (
      `Consistency check was done, but "${origin}" was not invoked.` +
      'Both "old" and "new" must be invoked to do a consistency check.'
    );
  }

  private _checkOriginEventConsistency(origin: LDMigrationOrigin): boolean {
    if (this._wasInvoked[origin]) {
      return true;
    }

    // If the specific origin was not invoked, but it contains measurements, then
    // that is a problem. Check each measurement and log a message if it is present.
    if (!Number.isNaN(this._latencyMeasurement[origin])) {
      this._logger?.error(`${this._logTag()} ${this._latencyConsistencyMessage(origin)}`);
      return false;
    }

    if (this._errors[origin]) {
      this._logger?.error(`${this._logTag()} ${this._errorConsistencyMessage(origin)}`);
      return false;
    }

    if (this._consistencyCheck !== LDConsistencyCheck.NotChecked) {
      this._logger?.error(`${this._logTag()} ${this._consistencyCheckConsistencyMessage(origin)}`);
      return false;
    }
    return true;
  }

  /**
   * Check that the latency, error, consistency and invoked measurements are self-consistent.
   */
  private _measurementConsistencyCheck(): boolean {
    return this._checkOriginEventConsistency('old') && this._checkOriginEventConsistency('new');
  }

  private _populateInvoked(measurements: LDMigrationMeasurement[]) {
    const measurement: LDMigrationInvokedMeasurement = {
      key: 'invoked',
      values: {},
    };
    if (!this._wasInvoked.old && !this._wasInvoked.new) {
      this._logger?.error('Migration op completed without executing any origins (old/new).');
    }
    if (this._wasInvoked.old) {
      measurement.values.old = true;
    }
    if (this._wasInvoked.new) {
      measurement.values.new = true;
    }
    measurements.push(measurement);
  }

  private _populateConsistency(measurements: LDMigrationMeasurement[]) {
    if (
      this._consistencyCheck !== undefined &&
      this._consistencyCheck !== LDConsistencyCheck.NotChecked
    ) {
      measurements.push({
        key: 'consistent',
        value: this._consistencyCheck === LDConsistencyCheck.Consistent,
        samplingRatio: this._checkRatio ?? 1,
      });
    }
  }

  private _populateErrors(measurements: LDMigrationMeasurement[]) {
    if (this._errors.new || this._errors.old) {
      const measurement: LDMigrationErrorMeasurement = {
        key: 'error',
        values: {},
      };
      if (this._errors.new) {
        measurement.values.new = true;
      }
      if (this._errors.old) {
        measurement.values.old = true;
      }
      measurements.push(measurement);
    }
  }

  private _populateLatency(measurements: LDMigrationMeasurement[]) {
    const newIsPopulated = isPopulated(this._latencyMeasurement.new);
    const oldIsPopulated = isPopulated(this._latencyMeasurement.old);
    if (newIsPopulated || oldIsPopulated) {
      const values: { old?: number; new?: number } = {};
      if (newIsPopulated) {
        values.new = this._latencyMeasurement.new;
      }
      if (oldIsPopulated) {
        values.old = this._latencyMeasurement.old;
      }
      measurements.push({
        key: 'latency_ms',
        values,
      });
    }
  }
}
