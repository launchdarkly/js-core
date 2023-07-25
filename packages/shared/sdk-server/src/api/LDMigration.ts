import { LDContext } from '@launchdarkly/js-sdk-common';
import { LDMigrationStage } from './data/LDMigrationStage';

/**
 * Specifies the origin of the result or error.
 *
 * Results from `readOld` or `writeOld` will be 'old'.
 * Results from `readNew` or `writeNew` will be 'new'.
 */
export type LDMigrationOrigin = 'old' | 'new';

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

export interface LDMigration<TMigrationRead, TMigrationWrite> {
  read(
    key: string,
    context: LDContext,
    defaultValue: LDMigrationStage
  ): Promise<LDMigrationResult<TMigrationRead>>;

  write(
    key: string,
    context: LDContext,
    defaultValue: LDMigrationStage
  ): Promise<LDMigrationResult<TMigrationWrite>>;
}
