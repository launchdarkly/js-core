import { LDEvaluationReason } from '@launchdarkly/js-sdk-common';

export type LDMigrationOp = 'read' | 'write';

interface LDMigrationEvaluation {
  key: string;
  value: any;
  default: any;
  variation?: number;
  reason: LDEvaluationReason;
}

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

export interface LDMigrationOpEvent {
  kind: 'migration_op';
  operation: LDMigrationOp;
  creationDate: number;
  contextKeys: Record<string, string>;
  evaluation: LDMigrationEvaluation;
  measurements: LDMigrationMeasurement[];
}
