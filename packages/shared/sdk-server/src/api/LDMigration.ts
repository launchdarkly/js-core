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
 * Result of a component of an LDMigration.
 *
 * Should not need to be used by a consumer of this API directly.
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
 * Result of a migration read operation.
 */
export type LDMigrationReadResult<TResult> = LDMigrationResult<TResult>;

/**
 * Result of a migration write operation.
 *
 * Authoritative writes are done before non-authoritative, so the authoritative
 * field should contain either an error or a result.
 *
 * If the authoritative write fails, then the non-authoritative operation will
 * not be executed. When this happens the nonAuthoritative field will not be
 * populated.
 *
 * When the non-authoritative operation is executed, then it will result in
 * either a result or an error and the field will be populated as such.
 */
export type LDMigrationWriteResult<TResult> = {
  authoritative: LDMigrationResult<TResult>;
  nonAuthoritative?: LDMigrationResult<TResult>;
};

/**
 * Interface representing a migration.
 */
export interface LDMigration<
  TMigrationRead,
  TMigrationWrite,
  TMigrationReadInput = any,
  TMigrationWriteInput = any,
> {
  /**
   * Perform a read using the migration.
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
    defaultValue: LDMigrationStage,
    payload?: TMigrationReadInput,
  ): Promise<LDMigrationReadResult<TMigrationRead>>;

  /**
   * Perform a write using the migration.
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
    defaultValue: LDMigrationStage,
    payload?: TMigrationWriteInput,
  ): Promise<LDMigrationWriteResult<TMigrationWrite>>;
}
