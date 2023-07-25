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

  describe.each([
    [new LDSerialExecution(LDExecutionOrdering.Fixed), 'serial fixed'],
    [new LDSerialExecution(LDExecutionOrdering.Random), 'serial random'],
    [new LDConcurrentExecution(), 'concurrent'],
  ])('given different execution methods: %p %p', (execution) => {
    it.each([
      [LDMigrationStage.Off, 'old', true],
      [LDMigrationStage.DualWrite, 'old', true],
      [LDMigrationStage.Shadow, 'old', true],
      [LDMigrationStage.Live, 'new', false],
      [LDMigrationStage.RampDown, 'new', false],
      [LDMigrationStage.Complete, 'new', false],
    ])(
      'uses the correct authoritative source: %p, read: %p, write: %p.',
      async (stage, readValue, writeResult) => {
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
        expect(write.success).toBeTruthy();
        expect(write.origin).toEqual(readValue);
        if (write.success) {
          expect(write.result).toEqual(writeResult);
        }
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
    [LDMigrationStage.Off, 'old', true, false],
    [LDMigrationStage.DualWrite, 'old', true, false],
    [LDMigrationStage.Shadow, 'old', true, false],
    [LDMigrationStage.Live, 'new', false, true],
    [LDMigrationStage.RampDown, 'new', false, true],
    [LDMigrationStage.Complete, 'new', false, true],
  ])('stops writes on error: %p, %p, %p, %p', async (stage, origin, oldWrite, newWrite) => {
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
    expect(write.success).toBeFalsy();
    expect(write.origin).toEqual(origin);
    if (!write.success) {
      expect(write.error.message).toEqual(origin);
    }
    expect(oldWriteCalled).toEqual(oldWrite);
    expect(newWriteCalled).toEqual(newWrite);
  });

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
    expect(write.success).toBeFalsy();
    expect(write.origin).toEqual(origin);
    if (!write.success) {
      expect(write.error.message).toEqual(origin);
    }
    expect(oldWriteCalled).toEqual(oldWrite);
    expect(newWriteCalled).toEqual(newWrite);
  });
});
