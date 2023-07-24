import { LDErrorTracking, LDExecutionOrdering, LDLatencyTracking, LDMigration, LDSerialExecution } from '../../src';

it('full migration typing', () => {
  const migration: LDMigration<string> = {
    execution: new LDSerialExecution(LDExecutionOrdering.Fixed),
    latencyTracking: LDLatencyTracking.Disabled,
    errorTracking: LDErrorTracking.Enabled,
    readNew: function (): string {
      return "potato";
    },
    writeNew: function (): string {
      return "pomme de terre"
    },
    readOld: function (): string {
      return "potato";
    },
    writeOld: function (): string {
      return "pomme de terre"
    },
    check(a, b) {
      return a == b;
    }
  };
});
