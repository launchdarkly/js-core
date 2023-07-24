export enum LDMigrationStage {
  Off = 'off',
  DualWrite = 'dualwrite',
  Shadow = 'shadow',
  Live = 'live',
  Rampdown = 'rampdown',
  Complete = 'complete',
}

export function IsMigrationStage(value: string): boolean {
  return Object.values(LDMigrationStage).includes(value as LDMigrationStage);
}
