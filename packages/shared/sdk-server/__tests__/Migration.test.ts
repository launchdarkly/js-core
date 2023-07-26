import {
  LDClientImpl,
  LDConcurrentExecution,
  LDErrorTracking,
  LDExecutionOrdering,
  LDLatencyTracking,
  LDMigrationStage,
  LDSerialExecution,
} from '../src';
import { LDClientCallbacks } from '../src/LDClientImpl';
import Migration, { LDMigrationError, LDMigrationSuccess } from '../src/Migration';
import { TestData } from '../src/integrations';
import basicPlatform from './evaluation/mocks/platform';
import makeCallbacks from './makeCallbacks';

describe('given an LDClient with test data', () => {
  let client: LDClientImpl;
  let td: TestData;
  let callbacks: LDClientCallbacks;

  beforeEach(async () => {
    td = new TestData();
    callbacks = makeCallbacks(false);
    client = new LDClientImpl(
      'sdk-key',
      basicPlatform,
      {
        updateProcessor: td.getFactory(),
        sendEvents: false,
      },
      callbacks
    );

    await client.waitForInitialization();
  });

  afterEach(() => {
    client.close();
  });

  /** Custom matcher for write results. */
  expect.extend({
    toMatchMigrationResult(received, expected) {
      const { authoritative, nonAuthoritative } = expected;
      const { authoritative: actualAuth, nonAuthoritative: actualNonAuth } = received;

      if (authoritative.origin !== actualAuth.origin) {
        return {
          pass: false,
          message: () =>
            `Expected authoritative origin: ${authoritative.origin}, but received: ${actualAuth.origin}`,
        };
      }
      if (authoritative.success !== actualAuth.success) {
        return {
          pass: false,
          message: () => `Expected authoritative success, but received error: ${actualAuth.error}`,
        };
      }
      if (authoritative.success) {
        if (actualAuth.result !== authoritative.result) {
          return {
            pass: false,
            message: () =>
              `Expected authoritative result: ${authoritative.result}, received: ${actualAuth.result}`,
          };
        }
      } else if (actualAuth.error?.message !== authoritative.error?.message) {
        return {
          pass: false,
          message: () =>
            `Expected authoritative error: ${authoritative.error?.message}, received: ${actualAuth.error?.message}`,
        };
      }
      if (nonAuthoritative) {
        if (!actualNonAuth) {
          return {
            pass: false,
            message: () => `Expected no authoritative result, but did not receive one.`,
          };
        }
        if (nonAuthoritative.origin !== actualNonAuth.origin) {
          return {
            pass: false,
            message: () =>
              `Expected non-authoritative origin: ${nonAuthoritative.origin}, but received: ${actualNonAuth.origin}`,
          };
        }
        if (nonAuthoritative.success !== actualNonAuth.success) {
          return {
            pass: false,
            message: () =>
              `Expected authoritative success, but received error: ${actualNonAuth.error}`,
          };
        }
        if (nonAuthoritative.success) {
          if (actualNonAuth.result !== nonAuthoritative.result) {
            return {
              pass: false,
              message: () =>
                `Expected non-authoritative result: ${nonAuthoritative.result}, received: ${actualNonAuth.result}`,
            };
          }
        } else if (actualNonAuth.error?.message !== nonAuthoritative.error?.message) {
          return {
            pass: false,
            message: () =>
              `Expected nonauthoritative error: ${nonAuthoritative.error?.message}, error: ${actualNonAuth.error?.message}`,
          };
        }
      } else if (actualNonAuth) {
        return {
          pass: false,
          message: () => `Expected no non-authoritative result, received: ${actualNonAuth}`,
        };
      }
      return { pass: true, message: () => '' };
    },
  });

  describe.each([
    [new LDSerialExecution(LDExecutionOrdering.Fixed), 'serial fixed'],
    [new LDSerialExecution(LDExecutionOrdering.Random), 'serial random'],
    [new LDConcurrentExecution(), 'concurrent'],
  ])('given different execution methods: %p %p', (execution) => {
    it.each([
      [
        LDMigrationStage.Off,
        'old',
        {
          authoritative: { origin: 'old', result: true, success: true },
          nonAuthoritative: undefined,
        },
      ],
      [
        LDMigrationStage.DualWrite,
        'old',
        {
          authoritative: { origin: 'old', result: true, success: true },
          nonAuthoritative: { origin: 'new', result: false, success: true },
        },
      ],
      [
        LDMigrationStage.Shadow,
        'old',
        {
          authoritative: { origin: 'old', result: true, success: true },
          nonAuthoritative: { origin: 'new', result: false, success: true },
        },
      ],
      [
        LDMigrationStage.Live,
        'new',
        {
          nonAuthoritative: { origin: 'old', result: true, success: true },
          authoritative: { origin: 'new', result: false, success: true },
        },
      ],
      [
        LDMigrationStage.RampDown,
        'new',
        {
          nonAuthoritative: { origin: 'old', result: true, success: true },
          authoritative: { origin: 'new', result: false, success: true },
        },
      ],
      [
        LDMigrationStage.Complete,
        'new',
        {
          authoritative: { origin: 'new', result: false, success: true },
          nonAuthoritative: undefined,
        },
      ],
    ])(
      'uses the correct authoritative source: %p, read: %p, write: %p.',
      async (stage, readValue, writeMatch) => {
        const migration = new Migration<string, boolean>(client, {
          execution,
          latencyTracking: LDLatencyTracking.Disabled,
          errorTracking: LDErrorTracking.Disabled,
          readNew: async () => LDMigrationSuccess('new'),
          writeNew: async () => LDMigrationSuccess(false),
          readOld: async () => LDMigrationSuccess('old'),
          writeOld: async () => LDMigrationSuccess(true),
        });

        const flagKey = 'migration';
        td.update(td.flag(flagKey).valueForAll(stage));

        // Get a default value that is not the value under test.
        const defaultStage = Object.values(LDMigrationStage).find((item) => item !== stage);

        const read = await migration.read(flagKey, { key: 'test-key' }, defaultStage!);
        expect(read.success).toBeTruthy();
        expect(read.origin).toEqual(readValue);
        // Type guards needed for typescript.
        if (read.success) {
          expect(read.result).toEqual(readValue);
        }

        const write = await migration.write(flagKey, { key: 'test-key' }, defaultStage!);
        // @ts-ignore Extended without writing types.
        expect(write).toMatchMigrationResult(writeMatch);
      }
    );
  });

  it.each([
    [LDMigrationStage.Off, 'old'],
    [LDMigrationStage.DualWrite, 'old'],
    [LDMigrationStage.Shadow, 'old'],
    [LDMigrationStage.Live, 'new'],
    [LDMigrationStage.RampDown, 'new'],
    [LDMigrationStage.Complete, 'new'],
  ])('handles read errors for stage: %p', async (stage, authority) => {
    const migration = new Migration<string, boolean>(client, {
      execution: new LDSerialExecution(LDExecutionOrdering.Fixed),
      latencyTracking: LDLatencyTracking.Disabled,
      errorTracking: LDErrorTracking.Disabled,
      readNew: async () => LDMigrationError(new Error('new')),
      writeNew: async () => LDMigrationSuccess(false),
      readOld: async () => LDMigrationError(new Error('old')),
      writeOld: async () => LDMigrationSuccess(true),
    });

    const flagKey = 'migration';
    td.update(td.flag(flagKey).valueForAll(stage));

    // Get a default value that is not the value under test.
    const defaultStage = Object.values(LDMigrationStage).find((item) => item !== stage);

    const read = await migration.read(flagKey, { key: 'test-key' }, defaultStage!);
    expect(read.success).toBeFalsy();
    expect(read.origin).toEqual(authority);
    // Type guards needed for typescript.
    if (!read.success) {
      expect(read.error.message).toEqual(authority);
    }
  });

  it.each([
    [LDMigrationStage.Off, 'old'],
    [LDMigrationStage.DualWrite, 'old'],
    [LDMigrationStage.Shadow, 'old'],
    [LDMigrationStage.Live, 'new'],
    [LDMigrationStage.RampDown, 'new'],
    [LDMigrationStage.Complete, 'new'],
  ])('handles exceptions for stage: %p', async (stage, authority) => {
    const migration = new Migration<string, boolean>(client, {
      execution: new LDSerialExecution(LDExecutionOrdering.Fixed),
      latencyTracking: LDLatencyTracking.Disabled,
      errorTracking: LDErrorTracking.Disabled,
      readNew: async () => {
        throw new Error('new');
      },
      writeNew: async () => LDMigrationSuccess(false),
      readOld: async () => {
        throw new Error('old');
      },
      writeOld: async () => LDMigrationSuccess(true),
    });

    const flagKey = 'migration';
    td.update(td.flag(flagKey).valueForAll(stage));

    // Get a default value that is not the value under test.
    const defaultStage = Object.values(LDMigrationStage).find((item) => item !== stage);

    const read = await migration.read(flagKey, { key: 'test-key' }, defaultStage!);
    expect(read.success).toBeFalsy();
    expect(read.origin).toEqual(authority);
    // Type guards needed for typescript.
    if (!read.success) {
      expect(read.error.message).toEqual(authority);
    }
  });

  it.each([
    [
      LDMigrationStage.Off,
      'old',
      true,
      false,
      {
        authoritative: { origin: 'old', success: false, error: new Error('old') },
        nonAuthoritative: undefined,
      },
    ],
    [
      LDMigrationStage.DualWrite,
      'old',
      true,
      false,
      {
        authoritative: { origin: 'old', success: false, error: new Error('old') },
        nonAuthoritative: undefined,
      },
    ],
    [
      LDMigrationStage.Shadow,
      'old',
      true,
      false,
      {
        authoritative: { origin: 'old', success: false, error: new Error('old') },
        nonAuthoritative: undefined,
      },
    ],
    [
      LDMigrationStage.Live,
      'new',
      false,
      true,
      {
        authoritative: { origin: 'new', success: false, error: new Error('new') },
        nonAuthoritative: undefined,
      },
    ],
    [
      LDMigrationStage.RampDown,
      'new',
      false,
      true,
      {
        authoritative: { origin: 'new', success: false, error: new Error('new') },
        nonAuthoritative: undefined,
      },
    ],
    [
      LDMigrationStage.Complete,
      'new',
      false,
      true,
      {
        authoritative: { origin: 'new', success: false, error: new Error('new') },
        nonAuthoritative: undefined,
      },
    ],
  ])(
    'stops writes on error: %p, %p, %p, %p',
    async (stage, origin, oldWrite, newWrite, writeMatch) => {
      let oldWriteCalled = false;
      let newWriteCalled = false;

      const migration = new Migration<string, boolean>(client, {
        execution: new LDSerialExecution(LDExecutionOrdering.Fixed),
        latencyTracking: LDLatencyTracking.Disabled,
        errorTracking: LDErrorTracking.Disabled,
        readNew: async () => LDMigrationSuccess('new'),
        writeNew: async () => {
          newWriteCalled = true;
          return LDMigrationError(new Error('new'));
        },
        readOld: async () => LDMigrationSuccess('old'),
        writeOld: async () => {
          oldWriteCalled = true;
          return LDMigrationError(new Error('old'));
        },
      });

      const flagKey = 'migration';
      td.update(td.flag(flagKey).valueForAll(stage));

      // Get a default value that is not the value under test.
      const defaultStage = Object.values(LDMigrationStage).find((item) => item !== stage);

      const write = await migration.write(flagKey, { key: 'test-key' }, defaultStage!);
      // @ts-ignore
      expect(write).toMatchMigrationResult(writeMatch);

      expect(oldWriteCalled).toEqual(oldWrite);
      expect(newWriteCalled).toEqual(newWrite);
    }
  );

  it.each([
    [LDMigrationStage.Off, 'old', true, false],
    [LDMigrationStage.DualWrite, 'old', true, false],
    [LDMigrationStage.Shadow, 'old', true, false],
    [LDMigrationStage.Live, 'new', false, true],
    [LDMigrationStage.RampDown, 'new', false, true],
    [LDMigrationStage.Complete, 'new', false, true],
  ])('stops writes on exception: %p, %p, %p, %p', async (stage, origin, oldWrite, newWrite) => {
    let oldWriteCalled = false;
    let newWriteCalled = false;

    const migration = new Migration<string, boolean>(client, {
      execution: new LDSerialExecution(LDExecutionOrdering.Fixed),
      latencyTracking: LDLatencyTracking.Disabled,
      errorTracking: LDErrorTracking.Disabled,
      readNew: async () => LDMigrationSuccess('new'),
      writeNew: async () => {
        newWriteCalled = true;
        throw new Error('new');
      },
      readOld: async () => LDMigrationSuccess('old'),
      writeOld: async () => {
        oldWriteCalled = true;
        throw new Error('old');
      },
    });

    const flagKey = 'migration';
    td.update(td.flag(flagKey).valueForAll(stage));

    // Get a default value that is not the value under test.
    const defaultStage = Object.values(LDMigrationStage).find((item) => item !== stage);

    const write = await migration.write(flagKey, { key: 'test-key' }, defaultStage!);
    expect(write.authoritative.success).toBeFalsy();
    expect(write.authoritative.origin).toEqual(origin);
    if (!write.authoritative.success) {
      expect(write.authoritative.error.message).toEqual(origin);
    }
    expect(oldWriteCalled).toEqual(oldWrite);
    expect(newWriteCalled).toEqual(newWrite);
  });

  it('handles the case where the authoritative write succeeds, but the non-authoritative fails', async () => {
    const migrationA = new Migration<string, boolean>(client, {
      execution: new LDSerialExecution(LDExecutionOrdering.Fixed),
      latencyTracking: LDLatencyTracking.Disabled,
      errorTracking: LDErrorTracking.Disabled,
      readNew: async () => LDMigrationSuccess('new'),
      writeNew: async () => {
        throw new Error('new');
      },
      readOld: async () => LDMigrationSuccess('old'),
      writeOld: async () => LDMigrationSuccess(true),
    });

    const flagKey = 'migration';
    td.update(td.flag(flagKey).valueForAll(LDMigrationStage.DualWrite));

    const writeA = await migrationA.write(flagKey, { key: 'test-key' }, LDMigrationStage.Off);
    // @ts-ignore
    expect(writeA).toMatchMigrationResult({
      authoritative: {
        success: true,
        result: true,
        origin: 'old',
      },
      nonAuthoritative: {
        success: false,
        error: new Error('new'),
        origin: 'new',
      },
    });

    td.update(td.flag(flagKey).valueForAll(LDMigrationStage.Shadow));

    const writeB = await migrationA.write(flagKey, { key: 'test-key' }, LDMigrationStage.Off);
    // @ts-ignore
    expect(writeB).toMatchMigrationResult({
      authoritative: {
        success: true,
        result: true,
        origin: 'old',
      },
      nonAuthoritative: {
        success: false,
        error: new Error('new'),
        origin: 'new',
      },
    });

    const migrationB = new Migration<string, boolean>(client, {
      execution: new LDSerialExecution(LDExecutionOrdering.Fixed),
      latencyTracking: LDLatencyTracking.Disabled,
      errorTracking: LDErrorTracking.Disabled,
      readNew: async () => LDMigrationSuccess('new'),
      writeNew: async () => LDMigrationSuccess(true),
      readOld: async () => LDMigrationSuccess('old'),
      writeOld: async () => {
        throw new Error('old');
      },
    });

    td.update(td.flag(flagKey).valueForAll(LDMigrationStage.Live));

    const writeC = await migrationB.write(flagKey, { key: 'test-key' }, LDMigrationStage.Off);
    // @ts-ignore
    expect(writeC).toMatchMigrationResult({
      authoritative: {
        success: true,
        result: true,
        origin: 'new',
      },
      nonAuthoritative: {
        success: false,
        error: new Error('old'),
        origin: 'old',
      },
    });

    td.update(td.flag(flagKey).valueForAll(LDMigrationStage.RampDown));

    const writeD = await migrationB.write(flagKey, { key: 'test-key' }, LDMigrationStage.Off);
    // @ts-ignore
    expect(writeD).toMatchMigrationResult({
      authoritative: {
        success: true,
        result: true,
        origin: 'new',
      },
      nonAuthoritative: {
        success: false,
        error: new Error('old'),
        origin: 'old',
      },
    });
  });
});
