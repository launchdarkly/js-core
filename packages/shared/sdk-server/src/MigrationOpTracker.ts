import { internal, LDEvaluationReason, LDLogger } from '@launchdarkly/js-sdk-common';

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
  private errors = {
    old: false,
    new: false,
  };

  private wasInvoked = {
    old: false,
    new: false,
  };

  private consistencyCheck: LDConsistencyCheck = LDConsistencyCheck.NotChecked;

  private latencyMeasurement = {
    old: NaN,
    new: NaN,
  };

  private operation?: LDMigrationOp;

  constructor(
    private readonly flagKey: string,
    private readonly contextKeys: Record<string, string>,
    private readonly defaultStage: LDMigrationStage,
    private readonly stage: LDMigrationStage,
    private readonly reason: LDEvaluationReason,
    private readonly checkRatio?: number,
    private readonly variation?: number,
    private readonly version?: number,
    private readonly samplingRatio?: number,
    private readonly logger?: LDLogger,
  ) {}

  op(op: LDMigrationOp) {
    this.operation = op;
  }

  error(origin: LDMigrationOrigin) {
    this.errors[origin] = true;
  }

  consistency(check: () => boolean) {
    if (internal.shouldSample(this.checkRatio ?? 1)) {
      try {
        const res = check();
        this.consistencyCheck = res
          ? LDConsistencyCheck.Consistent
          : LDConsistencyCheck.Inconsistent;
      } catch (exception) {
        this.logger?.error(
          'Exception when executing consistency check function for migration' +
            ` '${this.flagKey}' the consistency check will not be included in the generated migration` +
            ` op event. Exception: ${exception}`,
        );
      }
    }
  }

  latency(origin: LDMigrationOrigin, value: number) {
    this.latencyMeasurement[origin] = value;
  }

  invoked(origin: LDMigrationOrigin) {
    this.wasInvoked[origin] = true;
  }

  createEvent(): LDMigrationOpEvent | undefined {
    if (!this.operation) {
      this.logger?.error('The operation must be set using "op" before an event can be created.');
      return undefined;
    }

    if (Object.keys(this.contextKeys).length === 0) {
      this.logger?.error(
        'The migration was not done against a valid context and cannot generate an event.',
      );
      return undefined;
    }

    if (!this.wasInvoked.old && !this.wasInvoked.new) {
      this.logger?.error(
        'The migration invoked neither the "old" or "new" implementation and' +
          'an event cannot be generated',
      );
      return undefined;
    }

    if (!this.measurementConsistencyCheck()) {
      return undefined;
    }

    const measurements: LDMigrationMeasurement[] = [];

    this.populateInvoked(measurements);
    this.populateConsistency(measurements);
    this.populateLatency(measurements);
    this.populateErrors(measurements);

    return {
      kind: 'migration_op',
      operation: this.operation,
      creationDate: Date.now(),
      contextKeys: this.contextKeys,
      evaluation: {
        key: this.flagKey,
        value: this.stage,
        default: this.defaultStage,
        reason: this.reason,
        variation: this.variation,
        version: this.version,
      },
      measurements,
      samplingRatio: this.samplingRatio ?? 1,
    };
  }

  private logTag() {
    return `For migration ${this.operation}-${this.flagKey}:`;
  }

  private latencyConsistencyMessage(origin: LDMigrationOrigin) {
    return `Latency measurement for "${origin}", but "${origin}" was not invoked.`;
  }

  private errorConsistencyMessage(origin: LDMigrationOrigin) {
    return `Error occurred for "${origin}", but "${origin}" was not invoked.`;
  }

  private consistencyCheckConsistencyMessage(origin: LDMigrationOrigin) {
    return (
      `Consistency check was done, but "${origin}" was not invoked.` +
      'Both "old" and "new" must be invoked to do a consistency check.'
    );
  }

  private checkOriginEventConsistency(origin: LDMigrationOrigin): boolean {
    if (this.wasInvoked[origin]) {
      return true;
    }

    // If the specific origin was not invoked, but it contains measurements, then
    // that is a problem. Check each measurement and log a message if it is present.
    if (!Number.isNaN(this.latencyMeasurement[origin])) {
      this.logger?.error(`${this.logTag()} ${this.latencyConsistencyMessage(origin)}`);
      return false;
    }

    if (this.errors[origin]) {
      this.logger?.error(`${this.logTag()} ${this.errorConsistencyMessage(origin)}`);
      return false;
    }

    if (this.consistencyCheck !== LDConsistencyCheck.NotChecked) {
      this.logger?.error(`${this.logTag()} ${this.consistencyCheckConsistencyMessage(origin)}`);
      return false;
    }
    return true;
  }

  /**
   * Check that the latency, error, consistency and invoked measurements are self-consistent.
   */
  private measurementConsistencyCheck(): boolean {
    return this.checkOriginEventConsistency('old') && this.checkOriginEventConsistency('new');
  }

  private populateInvoked(measurements: LDMigrationMeasurement[]) {
    const measurement: LDMigrationInvokedMeasurement = {
      key: 'invoked',
      values: {},
    };
    if (!this.wasInvoked.old && !this.wasInvoked.new) {
      this.logger?.error('Migration op completed without executing any origins (old/new).');
    }
    if (this.wasInvoked.old) {
      measurement.values.old = true;
    }
    if (this.wasInvoked.new) {
      measurement.values.new = true;
    }
    measurements.push(measurement);
  }

  private populateConsistency(measurements: LDMigrationMeasurement[]) {
    if (
      this.consistencyCheck !== undefined &&
      this.consistencyCheck !== LDConsistencyCheck.NotChecked
    ) {
      measurements.push({
        key: 'consistent',
        value: this.consistencyCheck === LDConsistencyCheck.Consistent,
        samplingRatio: this.checkRatio ?? 1,
      });
    }
  }

  private populateErrors(measurements: LDMigrationMeasurement[]) {
    if (this.errors.new || this.errors.old) {
      const measurement: LDMigrationErrorMeasurement = {
        key: 'error',
        values: {},
      };
      if (this.errors.new) {
        measurement.values.new = true;
      }
      if (this.errors.old) {
        measurement.values.old = true;
      }
      measurements.push(measurement);
    }
  }

  private populateLatency(measurements: LDMigrationMeasurement[]) {
    const newIsPopulated = isPopulated(this.latencyMeasurement.new);
    const oldIsPopulated = isPopulated(this.latencyMeasurement.old);
    if (newIsPopulated || oldIsPopulated) {
      const values: { old?: number; new?: number } = {};
      if (newIsPopulated) {
        values.new = this.latencyMeasurement.new;
      }
      if (oldIsPopulated) {
        values.old = this.latencyMeasurement.old;
      }
      measurements.push({
        key: 'latency_ms',
        values,
      });
    }
  }
}
