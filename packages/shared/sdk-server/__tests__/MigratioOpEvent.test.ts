import {
  LDClientImpl,
  LDConcurrentExecution,
  LDErrorTracking,
  LDExecutionOrdering,
  LDLatencyTracking,
  LDMigrationStage,
  LDSerialExecution,
  internal,
} from '../src';
import { LDClientCallbacks } from '../src/LDClientImpl';
import Migration, { LDMigrationError, LDMigrationSuccess } from '../src/Migration';
import { TestData } from '../src/integrations';
import basicPlatform from './evaluation/mocks/platform';
import makeCallbacks from './makeCallbacks';

describe('given an LDClient with test data', () => {
  let client: LDClientImpl;
  let events: internal.InputEvent[];
  let td: TestData;
  let callbacks: LDClientCallbacks;

  beforeEach(async () => {
    events = [];
    jest
      .spyOn(internal.EventProcessor.prototype, 'sendEvent')
      .mockImplementation((evt) => events.push(evt));

    td = new TestData();
    callbacks = makeCallbacks(false);
    client = new LDClientImpl(
      'sdk-key',
      basicPlatform,
      {
        updateProcessor: td.getFactory(),
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
    describe('given a migration which produces errors for every step', () => {
      let migration: Migration<string, boolean>;
      beforeEach(() => {
        migration = new Migration<string, boolean>(client, {
          execution,
          latencyTracking: LDLatencyTracking.Disabled,
          errorTracking: LDErrorTracking.Disabled,
          readNew: async () => LDMigrationError(new Error('error')),
          writeNew: async () => LDMigrationError(new Error('error')),
          readOld: async () => LDMigrationError(new Error('error')),
          writeOld: async () => LDMigrationError(new Error('error')),
        });
      });

      it('can report errors for old reads', async () => {
        const flagKey = 'migration';
        td.update(td.flag(flagKey).valueForAll(LDMigrationStage.Off));

        const read = await migration.read(flagKey, { key: 'test' }, LDMigrationStage.Off);
        expect(events.length).toBe(2);
      });
    });
  });
});
