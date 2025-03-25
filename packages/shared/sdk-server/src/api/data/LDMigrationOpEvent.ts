import { LDContext, LDEvaluationReason } from '@launchdarkly/js-sdk-common';

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
  version?: number;
  reason: LDEvaluationReason;
}

export interface LDMigrationConsistencyMeasurement {
  key: 'consistent';
  value: boolean;
  samplingRatio: number;
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
    old?: boolean;
    new?: boolean;
  };
}

export interface LDMigrationInvokedMeasurement {
  key: 'invoked';
  values: {
    old?: boolean;
    new?: boolean;
  };
}

/**
 * Types of measurements supported by an LDMigrationOpEvent.
 */
export type LDMigrationMeasurement =
  | LDMigrationLatencyMeasurement
  | LDMigrationErrorMeasurement
  | LDMigrationConsistencyMeasurement
  | LDMigrationInvokedMeasurement;

/**
 * Event used to track information about a migration operation.
 *
 * Generally this event should not be created directly and instead an
 * LDMigrationOpTracker should be used to generate it.
 */
export interface LDMigrationOpEvent {
  kind: 'migration_op';
  operation: LDMigrationOp;
  creationDate: number;
  /**
   * @deprecated Use 'context' instead.
   */
  contextKeys?: Record<string, string>;
  context?: LDContext;
  evaluation: LDMigrationEvaluation;
  measurements: LDMigrationMeasurement[];
  samplingRatio: number;
}
