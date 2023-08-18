import { LDEvaluationReason } from '@launchdarkly/js-sdk-common';

import { LDMigrationStage, LDMigrationTracker } from './api';
import {
  LDConsistencyCheck,
  LDMigrationErrorMeasurement,
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

  private consistencyCheck?: LDConsistencyCheck;

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
  ) {}

  op(op: LDMigrationOp) {
    this.operation = op;
  }

  error(origin: LDMigrationOrigin) {
    this.errors[origin] = true;
  }

  consistency(result: LDConsistencyCheck) {
    this.consistencyCheck = result;
  }

  latency(origin: LDMigrationOrigin, value: number) {
    this.latencyMeasurement[origin] = value;
  }

  createEvent(): LDMigrationOpEvent | undefined {
    if (this.operation && Object.keys(this.contextKeys).length) {
      const measurements: LDMigrationMeasurement[] = [];

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
        },
        measurements,
      };
    }
    return undefined;
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
