import { LDMigrationOrigin } from '../LDMigration';
import { LDMigrationOp, LDMigrationOpEvent } from './LDMigrationOpEvent';
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
   * Check the consistency of a read result. This method should be invoked if the `check` function
   * is defined for the migration and both reads ("new"/"old") were done.
   *
   * The function will use the checkRatio to determine if the check should be executed, and it
   * will record the result.
   *
   * Example calling the check function from the migration config.
   * ```
   * context.tracker.consistency(() => config.check!(oldValue.result, newValue.result));
   * ```
   *
   * If the consistency check function throws an exception, then the consistency check result
   * will not be included in the generated event.
   *
   * @param check The function which executes the check. This is not the `check` function from the
   * migration options, but instead should be a parameter-less function that calls that function.
   */
  consistency(check: () => boolean): void;

  /**
   * Call this to report that an origin was invoked (executed). There are some situations where the
   * expectation is that both the old and new implementation will be used, but with writes
   * it is possible that the non-authoritative will not execute. Reporting the execution allows
   * for more accurate analytics.
   *
   * @param origin The origin that was invoked.
   */
  invoked(origin: LDMigrationOrigin): void;

  /**
   * Report the latency of an operation.
   *
   * @param origin The origin the latency is being reported for.
   * @param value The latency, in milliseconds, of the operation.
   */
  latency(origin: LDMigrationOrigin, value: number): void;

  /**
   * Create a migration op event. If the event could not be created, because of a missing
   * operation, then undefined is returned.
   */
  createEvent(): LDMigrationOpEvent | undefined;
}

/**
 * Migration value and tracker.
 */
export interface LDMigrationVariation {
  /**
   * The result of the flag evaluation. This will be either one of the flag's variations or
   * the default value that was passed to `LDClient.variationMigration`.
   */
  value: LDMigrationStage;

  /**
   * A tracker which can be used to generate analytics for the migration.
   */
  tracker: LDMigrationTracker;
}
