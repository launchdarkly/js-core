/**
 * Stage denotes one of six possible stages a technology migration could be a
 * part of, progressing through the following order.
 *
 * Off -> DualWrite -> Shadow -> Live -> RampDown -> Complete
 */
export enum LDMigrationStage {
  /**
   * Off - migration hasn't started, "old" is authoritative for reads and writes
   */
  Off = 'off',

  /**
   * DualWrite - write to both "old" and "new", "old" is authoritative for reads
   */
  DualWrite = 'dualwrite',

  /**
   * Shadow - both "new" and "old" versions run with a preference for "old"
   */
  Shadow = 'shadow',

  /**
   * Live - both "new" and "old" versions run with a preference for "new"
   */
  Live = 'live',

  /**
   * RampDown - only read from "new", write to "old" and "new"
   */
  RampDown = 'rampdown',

  /**
   * Complete - migration is done
   */
  Complete = 'complete',
}

/**
 * Check if the given string is a migration stage.
 * @param value The string to check.
 * @returns True if the string is a migration stage.
 */
export function IsMigrationStage(value: string): boolean {
  return Object.values(LDMigrationStage).includes(value as LDMigrationStage);
}
