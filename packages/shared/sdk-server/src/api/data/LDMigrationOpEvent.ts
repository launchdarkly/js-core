import { LDEvaluationReason } from '@launchdarkly/js-sdk-common';

import { LDMigrationStage } from './LDMigrationStage';

export type LDMigrationOp = 'read' | 'write';

/**
 * Component of an LDMigrationOpEvent which tracks information about the
 * evaluation of the migration flag.
 */
export interface LDMigrationEvaluation {
  key: string;
  value: LDMigrationStage;
  default: LDMigrationStage;
  variation?: number;
  reason: LDEvaluationReason;
}

export interface LDMigrationCustomMeasurement {
  type: 'custom';
  key: string;
  values: {
    old?: number;
    new?: number;
  };
}

export interface LDMigrationConsistencyMeasurement {
  key: 'consistent';
  value: number;
  samplingOdds: number;
}

export interface LDMigrationLatencyMeasurement {
  key: 'latency_ms';
  values: {
    old?: number;
    new?: number;
  };
}

export interface LDMigrationErrorMeasurement {
  key: 'error';
  values: {
    old?: number;
    new?: number;
  };
}

/**
 * Types of measurements supported by an LDMigrationOpEvent.
 */
export type LDMigrationMeasurement =
  | LDMigrationLatencyMeasurement
  | LDMigrationErrorMeasurement
  | LDMigrationConsistencyMeasurement
  | LDMigrationCustomMeasurement;

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
