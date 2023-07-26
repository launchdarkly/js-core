import { Context, LDEvaluationReason } from '@launchdarkly/js-sdk-common';
import { LDMigrationStage, LDMigrationTracker } from './api';
import {
  LDMigrationOp,
  LDMigrationOpEvent,
  LDConsistencyCheck,
  LDMigrationMeasurement,
} from './api/data';
import { LDMigrationOrigin } from './api/LDMigration';

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
    private readonly context: Context,
    private readonly defaultStage: LDMigrationStage,
    private readonly stage: LDMigrationStage,
    private readonly reason: LDEvaluationReason,
    private readonly variation?: number
  ) {}

  op(op: LDMigrationOp) {
    this.operation = op;
  }

  /**
   * Report that an error happened in either the 'new' or 'old' implementation.
   *
   * This just tracks errors that occur, not the details of the errors.
   */
  error(origin: LDMigrationOrigin) {
    this.errors[origin] = true;
  }

  /**
   * Report if a consistency check was consistent, inconsistent, or not checked.
   */
  consistency(result: LDConsistencyCheck) {
    this.consistencyCheck = result;
  }

  /**
   * Report the latency for an implementation.
   *
   * @param origin If the latency is for the 'old' or 'new' implementation.
   * @param value The latency of the operation in milliseconds (TODO is it MS?).
   */
  latency(origin: LDMigrationOrigin, value: number) {
    this.latencyMeasurement[origin] = value;
  }

  createEvent(): LDMigrationOpEvent | undefined {
    if (this.operation && this.context.valid) {
      const measurements: LDMigrationMeasurement[] = [];
      if (
        // Cannot use a truthy check as 0 is a desired value.
        this.consistencyCheck !== undefined &&
        this.consistencyCheck !== LDConsistencyCheck.NotChecked
      ) {
        measurements.push({
          key: 'consistent',
          value: this.consistencyCheck,
          // TODO: Needs to come from someplace.
          samplingOdds: 0,
        });
      }
      if (
        !Number.isNaN(this.latencyMeasurement.new) ||
        !Number.isNaN(this.latencyMeasurement.old)
      ) {
        const values: { old?: number; new?: number } = {};
        if (!Number.isNaN(this.latencyMeasurement.new)) {
          values.new = this.latencyMeasurement.new;
        }
        if (!Number.isNaN(this.latencyMeasurement.old)) {
          values.old = this.latencyMeasurement.old;
        }
        measurements.push({
          key: 'latency',
          values,
        });
      }
      if (this.errors.new || this.errors.old) {
        measurements.push({
          key: 'error',
          values: {
            old: this.errors.old ? 1 : 0,
            new: this.errors.new ? 1 : 0,
          },
        });
      }
      return {
        kind: 'migration_op',
        operation: this.operation,
        creationDate: Date.now(),
        contextKeys: this.context.kindsAndKeys,
        evaluation: {
          key: this.flagKey,
          value: this.stage,
          default: this.defaultStage,
          reason: this.reason,
        },
        measurements,
      };
    }
    return undefined;
  }
}
