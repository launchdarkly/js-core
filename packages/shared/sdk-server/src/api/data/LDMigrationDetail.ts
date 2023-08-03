import { LDEvaluationReason } from '@launchdarkly/js-sdk-common';

import { LDMigrationOrigin } from '../LDMigration';
import {
  LDMigrationCustomMeasurement,
  LDMigrationOp,
  LDMigrationOpEvent,
} from './LDMigrationOpEvent';
import { LDMigrationStage } from './LDMigrationStage';

/**
 * Used for reporting the state of a consistency check.
 */
export enum LDConsistencyCheck {
  Inconsistent = 0,
  Consistent = 1,
  NotChecked = 2,
}

/**
 * Used to track information related to a migration operation.
 *
 * TKTK
 */
export interface LDMigrationTracker {
  /**
   * Sets the migration related operation associated with these tracking measurements.
   *
   * @param op The operation being tracked.
   */
  op(op: LDMigrationOp): void;

  /**
   * Report that an error has occurred for the specified origin.
   *
   * @param origin The origin of the error.
   */
  error(origin: LDMigrationOrigin): void;

  /**
   * Report the result of a consistency check.
   *
   * @param result The result of the check.
   */
  consistency(result: LDConsistencyCheck): void;

  /**
   * Report the latency of an operation.
   *
   * @param origin The origin the latency is being reported for.
   * @param value The latency, in milliseconds, of the operation.
   */
  latency(origin: LDMigrationOrigin, value: number): void;

  /**
   * Report a custom measurement. Unlike other methods on the tracker multiple custom
   * measurements can be reported.
   *
   * @param measurement The custom measurement to track.
   */
  custom(measurement: LDMigrationCustomMeasurement): void;

  /**
   * Create a migration op event. If the event could not be created, because of a missing
   * operation, then an event will not be returned.
   */
  createEvent(): LDMigrationOpEvent | undefined;
}

/**
 * Detailed information about a migration variation.
 */
export interface LDMigrationDetail {
  /**
   * The result of the flag evaluation. This will be either one of the flag's variations or
   * the default value that was passed to `LDClient.variationDetail`.
   */
  value: LDMigrationStage;

  /**
   * The index of the returned value within the flag's list of variations, e.g. 0 for the
   * first variation-- or `null` if the default value was returned.
   */
  variationIndex?: number | null;

  /**
   * An object describing the main factor that influenced the flag evaluation value.
   */
  reason: LDEvaluationReason;

  /**
   * A tracker which which can be used to generate analytics for the migration.
   */
  tracker: LDMigrationTracker;
}
