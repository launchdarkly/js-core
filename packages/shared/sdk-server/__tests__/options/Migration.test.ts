import {
  LDErrorTracking,
  LDExecutionOrdering,
  LDLatencyTracking,
  LDMigration,
  LDSerialExecution,
} from '../../src';

it('full migration typing', () => {
  const migration: LDMigration<string> = {
    execution: new LDSerialExecution(LDExecutionOrdering.Fixed),
    latencyTracking: LDLatencyTracking.Disabled,
    errorTracking: LDErrorTracking.Enabled,
    readNew(): string {
      return 'potato';
    },
    writeNew(): string {
      return 'pomme de terre';
    },
    readOld(): string {
      return 'potato';
    },
    writeOld(): string {
      return 'pomme de terre';
    },
    check(a, b) {
      return a === b;
    },
  };
});
