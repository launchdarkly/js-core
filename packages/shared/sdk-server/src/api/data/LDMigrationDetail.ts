import { LDEvaluationReason } from '@launchdarkly/js-sdk-common';
import { LDMigrationStage } from './LDMigrationStage';
import { LDMigrationOrigin } from '../LDMigration';
import { LDMigrationOp, LDMigrationOpEvent } from './LDMigrationOpEvent';

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
  op(op: LDMigrationOp): void;
  error(origin: LDMigrationOrigin): void;
  consistency(result: LDConsistencyCheck): void;
  latency(origin: LDMigrationOrigin, value: number): void;
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
