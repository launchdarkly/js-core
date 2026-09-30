import {
  createMigration,
  LDMigrationError,
  LDMigrationSuccess,
  LDMigrationTracker,
} from '../src/index';

describe('package exports', () => {
  it('exports the migration result helpers as runtime values', () => {
    expect(typeof createMigration).toBe('function');
    expect(typeof LDMigrationSuccess).toBe('function');
    expect(typeof LDMigrationError).toBe('function');

    const error = new Error('example error');
    expect(LDMigrationError(error)).toEqual({ success: false, error });
  });

  it('exports the LDMigrationTracker type', () => {
    // This assignment only compiles when the type is exported.
    const tracker: LDMigrationTracker | undefined = undefined;
    expect(tracker).toBeUndefined();
  });
});
