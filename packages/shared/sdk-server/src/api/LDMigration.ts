import { LDContext } from '@launchdarkly/js-sdk-common';
import { LDMigrationStage } from './data/LDMigrationStage';

/**
 * Specifies the origin of the result or error.
 *
 * Results from `readOld` or `writeOld` will be 'old'.
 * Results from `readNew` or `writeNew` will be 'new'.
 */
export type LDMigrationOrigin = 'old' | 'new';

/**
 * Result of a migration operation.
 */
export type LDMigrationResult<TResult> =
  | {
      success: true;
      origin: LDMigrationOrigin;
      result: TResult;
    }
  | {
      success: false;
      origin: LDMigrationOrigin;
      error: any;
    };

/**
 * Interface for a migration.
 *
 * TKTK
 */
export interface LDMigration<TMigrationRead, TMigrationWrite> {
  /**
   * TKTK
   *
   * @param key The key of the flag controlling the migration.
   * @param context The context requesting the flag. The client will generate an analytics event to
   *   register this context with LaunchDarkly if the context does not already exist.
   * @param defaultValue The default migration step. Used if the value is not available from
   * LaunchDarkly.
   */
  read(
    key: string,
    context: LDContext,
    defaultValue: LDMigrationStage
  ): Promise<LDMigrationResult<TMigrationRead>>;

  /**
   * TKTK
   *
   * @param key The key of the flag controlling the migration.
   * @param context The context requesting the flag. The client will generate an analytics event to
   *   register this context with LaunchDarkly if the context does not already exist.
   * @param defaultValue The default migration step. Used if the value is not available from
   * LaunchDarkly.
   */
  write(
    key: string,
    context: LDContext,
    defaultValue: LDMigrationStage
  ): Promise<LDMigrationResult<TMigrationWrite>>;
}
