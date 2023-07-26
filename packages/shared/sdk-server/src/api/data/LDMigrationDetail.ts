import { LDEvaluationReason } from '@launchdarkly/js-sdk-common';
import { LDMigrationStage } from './LDMigrationStage';

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
  }
  