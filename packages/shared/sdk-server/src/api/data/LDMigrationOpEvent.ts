import { LDEvaluationReason } from '@launchdarkly/js-sdk-common';

export type LDMigrationOp = 'read' | 'write';

interface LDMigrationEvaluation {
  key: string;
  value: any;
  default: any;
  prereqOf?: string;
  variation?: number;
  version?: number;
  reason?: LDEvaluationReason;
}

type LDMigrationMeasurement = {
  key: 'latency' | 'error',
  values: {
    old: number,
    new: number
  }
} | {
  key: 'consistency_error'
  value: number
}

export interface LDMigrationOpEvent {
  kind: 'migration_op';
  operation: LDMigrationOp;
  creationData: Date;
  samplingOdds: number;
  contextKeys: Record<string, string>;
  evaluation: LDMigrationEvaluation;
  measurements: LDMigrationMeasurement[];
}
