import { LDEvaluationReason } from '@launchdarkly/js-sdk-common';

export type LDMigrationOp = 'read' | 'write';

/**
 * Component of an LDMigrationOpEvent which tracks information about the
 * evaluation of the migration flag.
 */
interface LDMigrationEvaluation {
  key: string;
  value: any;
  default: any;
  variation?: number;
  reason: LDEvaluationReason;
}

/**
 * Types of measurements supported by an LDMigrationOpEvent.
 */
export type LDMigrationMeasurement =
  | {
      key: 'latency' | 'error';
      values: {
        old?: number;
        new?: number;
      };
    }
  | {
      key: 'consistent';
      value: number;
      samplingOdds: number;
    };

/**
 * Event used to track information about a migration operation.
 *
 * Generally this event should not be created directly and instead an
 * {@link MigrationOpTracker} should be used to generate it.
 */
export interface LDMigrationOpEvent {
  kind: 'migration_op';
  operation: LDMigrationOp;
  creationDate: number;
  contextKeys: Record<string, string>;
  evaluation: LDMigrationEvaluation;
  measurements: LDMigrationMeasurement[];
}
