export type LDMigrationStage = 'off' | 'dualwrite' | 'shadow' | 'live' | 'rampdown' | 'complete';

const stages = ['off', 'dualwrite', 'shadow', 'live', 'rampdown', 'complete'];

export function IsMigrationStage(value: string): boolean {
  return stages.includes(value);
}
