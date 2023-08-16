import { InputMigrationEvent } from '@launchdarkly/js-sdk-common/dist/internal';

import {
  internal,
  LDClientImpl,
  LDConcurrentExecution,
  LDExecutionOrdering,
  LDMigrationOpEvent,
  LDMigrationStage,
  LDSerialExecution,
} from '../src';
import { TestData } from '../src/integrations';
import { LDClientCallbacks } from '../src/LDClientImpl';
import Migration, { LDMigrationError, LDMigrationSuccess } from '../src/Migration';
import MigrationOpEventConversion from '../src/MigrationOpEventConversion';
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
      callbacks,
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
    describe('given a migration which checks consistency and produces consistent results', () => {
      let migration: Migration<string, string>;
      beforeEach(() => {
        migration = new Migration(client, {
          execution,
          latencyTracking: false,
          errorTracking: false,
          readNew: async (payload?: string) => LDMigrationSuccess(payload || 'default'),
          writeNew: async (payload?: string) => LDMigrationSuccess(payload || 'default'),
          readOld: async (payload?: string) => LDMigrationSuccess(payload || 'default'),
          writeOld: async (payload?: string) => LDMigrationSuccess(payload || 'default'),
          check: (a: string, b: string) => a === b,
        });
      });

      it.each([LDMigrationStage.Shadow, LDMigrationStage.Live])(
        'finds the results consistent: %p',
        async (stage) => {
          const flagKey = 'migration';
          td.update(td.flag(flagKey).valueForAll(stage));

          await migration.read(flagKey, { key: 'test' }, stage);
          expect(events.length).toBe(2);
          // Only check the measurements component of the event.
          const migrationEvent = events[1] as InputMigrationEvent;
          expect(migrationEvent.measurements[0].key).toEqual('consistent');
          // This isn't a precise check, but we should have non-zero values.
          expect(migrationEvent.measurements[0].value).toEqual(1);
        },
      );
    });

    describe('given a migration which checks consistency and produces inconsistent results', () => {
      let migration: Migration<string, string>;
      beforeEach(() => {
        migration = new Migration(client, {
          execution,
          latencyTracking: false,
          errorTracking: false,
          readNew: async () => LDMigrationSuccess('a'),
          writeNew: async () => LDMigrationSuccess('b'),
          readOld: async () => LDMigrationSuccess('c'),
          writeOld: async () => LDMigrationSuccess('d'),
          check: (a: string, b: string) => a === b,
        });
      });

      it.each([LDMigrationStage.Shadow, LDMigrationStage.Live])(
        'finds the results consistent: %p',
        async (stage) => {
          const flagKey = 'migration';
          td.update(td.flag(flagKey).valueForAll(stage));

          await migration.read(flagKey, { key: 'test' }, stage);
          expect(events.length).toBe(2);
          // Only check the measurements component of the event.
          const migrationEvent = events[1] as InputMigrationEvent;
          expect(migrationEvent.measurements[0].key).toEqual('consistent');
          // This isn't a precise check, but we should have non-zero values.
          expect(migrationEvent.measurements[0].value).toEqual(0);
        },
      );
    });

    describe('given a migration which takes time to execute and tracks latency', () => {
      let migration: Migration<string, string>;

      function timeoutPromise<TReturn>(val: TReturn): Promise<TReturn> {
        return new Promise((a) => {
          setTimeout(() => a(val), 2);
        });
      }

      beforeEach(() => {
        migration = new Migration(client, {
          execution,
          latencyTracking: true,
          errorTracking: false,
          readNew: async () => timeoutPromise(LDMigrationSuccess('readNew')),
          writeNew: async () => timeoutPromise(LDMigrationSuccess('writeNew')),
          readOld: async () => timeoutPromise(LDMigrationSuccess('readOld')),
          writeOld: async () => timeoutPromise(LDMigrationSuccess('writeOld')),
        });
      });

      it.each([LDMigrationStage.Shadow, LDMigrationStage.Live])(
        'can report read latency for new and old',
        async (stage) => {
          const flagKey = 'migration';
          td.update(td.flag(flagKey).valueForAll(stage));

          await migration.read(flagKey, { key: 'test' }, stage);
          expect(events.length).toBe(2);
          // Only check the measurements component of the event.
          const migrationEvent = events[1] as InputMigrationEvent;
          expect(migrationEvent.measurements[0].key).toEqual('latency_ms');
          // This isn't a precise check, but we should have non-zero values.
          expect(migrationEvent.measurements[0].values.old).toBeGreaterThanOrEqual(1);
          expect(migrationEvent.measurements[0].values.new).toBeGreaterThanOrEqual(1);
        },
      );

      it.each([LDMigrationStage.Off, LDMigrationStage.DualWrite])(
        'can report latency for old reads',
        async (stage) => {
          const flagKey = 'migration';
          td.update(td.flag(flagKey).valueForAll(stage));

          await migration.read(flagKey, { key: 'test' }, stage);
          expect(events.length).toBe(2);
          // Only check the measurements component of the event.
          const migrationEvent = events[1] as InputMigrationEvent;
          expect(migrationEvent.measurements[0].key).toEqual('latency_ms');
          // This isn't a precise check, but we should have non-zero values.
          expect(migrationEvent.measurements[0].values.old).toBeGreaterThanOrEqual(1);
          expect(migrationEvent.measurements[0].values.new).toBeUndefined();
        },
      );

      it.each([LDMigrationStage.RampDown, LDMigrationStage.Complete])(
        'can report latency for new reads',
        async (stage) => {
          const flagKey = 'migration';
          td.update(td.flag(flagKey).valueForAll(stage));

          await migration.read(flagKey, { key: 'test' }, stage);
          expect(events.length).toBe(2);
          // Only check the measurements component of the event.
          const migrationEvent = events[1] as InputMigrationEvent;
          expect(migrationEvent.measurements[0].key).toEqual('latency_ms');
          // This isn't a precise check, but we should have non-zero values.
          expect(migrationEvent.measurements[0].values.new).toBeGreaterThanOrEqual(1);
          expect(migrationEvent.measurements[0].values.old).toBeUndefined();
        },
      );

      it.each([LDMigrationStage.Off])('can report latency for old writes: %p', async (stage) => {
        const flagKey = 'migration';
        td.update(td.flag(flagKey).valueForAll(stage));

        await migration.write(flagKey, { key: 'test' }, stage);
        expect(events.length).toBe(2);
        // Only check the measurements component of the event.
        const migrationEvent = events[1] as InputMigrationEvent;
        expect(migrationEvent.measurements[0].key).toEqual('latency_ms');
        // This isn't a precise check, but we should have non-zero values.
        expect(migrationEvent.measurements[0].values.old).toBeGreaterThanOrEqual(1);
        expect(migrationEvent.measurements[0].values.new).toBeUndefined();
      });

      it.each([LDMigrationStage.Complete])(
        'can report latency for new writes: %p',
        async (stage) => {
          const flagKey = 'migration';
          td.update(td.flag(flagKey).valueForAll(stage));

          await migration.write(flagKey, { key: 'test' }, stage);
          expect(events.length).toBe(2);
          // Only check the measurements component of the event.
          const migrationEvent = events[1] as InputMigrationEvent;
          expect(migrationEvent.measurements[0].key).toEqual('latency_ms');
          // This isn't a precise check, but we should have non-zero values.
          expect(migrationEvent.measurements[0].values.new).toBeGreaterThanOrEqual(1);
          expect(migrationEvent.measurements[0].values.old).toBeUndefined();
        },
      );

      it.each([LDMigrationStage.DualWrite, LDMigrationStage.Shadow, LDMigrationStage.Live])(
        'can report latency for old and new writes: %p',
        async (stage) => {
          const flagKey = 'migration';
          td.update(td.flag(flagKey).valueForAll(stage));

          await migration.write(flagKey, { key: 'test' }, stage);
          expect(events.length).toBe(2);
          // Only check the measurements component of the event.
          const migrationEvent = events[1] as InputMigrationEvent;
          expect(migrationEvent.measurements[0].key).toEqual('latency_ms');
          // This isn't a precise check, but we should have non-zero values.
          expect(migrationEvent.measurements[0].values.old).toBeGreaterThanOrEqual(1);
          expect(migrationEvent.measurements[0].values.new).toBeGreaterThanOrEqual(1);
        },
      );

      it('can report write latency for new', async () => {
        const flagKey = 'migration';
        td.update(td.flag(flagKey).valueForAll(LDMigrationStage.Live));

        await migration.write(flagKey, { key: 'test' }, LDMigrationStage.Live);
        expect(events.length).toBe(2);
        // Only check the measurements component of the event.
        const migrationEvent = events[1] as InputMigrationEvent;
        expect(migrationEvent.measurements[0].key).toEqual('latency_ms');
        // This isn't a precise check, but we should have non-zero values.
        expect(migrationEvent.measurements[0].values.old).toBeGreaterThanOrEqual(1);
        expect(migrationEvent.measurements[0].values.new).toBeGreaterThanOrEqual(1);
      });
    });

    describe('given a migration which produces errors for every step', () => {
      let migration: Migration<string, boolean>;
      beforeEach(() => {
        migration = new Migration<string, boolean>(client, {
          execution,
          latencyTracking: false,
          errorTracking: true,
          readNew: async () => LDMigrationError(new Error('error')),
          writeNew: async () => LDMigrationError(new Error('error')),
          readOld: async () => LDMigrationError(new Error('error')),
          writeOld: async () => LDMigrationError(new Error('error')),
        });
      });

      it.each([LDMigrationStage.Off, LDMigrationStage.DualWrite])(
        'can report errors for old reads: %p',
        async (stage) => {
          const flagKey = 'migration';
          td.update(td.flag(flagKey).valueForAll(stage));

          await migration.read(flagKey, { key: 'test' }, stage);
          expect(events.length).toBe(2);
          // Only check the measurements component of the event.
          expect(events[1]).toMatchObject({
            measurements: [
              {
                key: 'error',
                values: {
                  old: 1,
                  new: 0,
                },
              },
            ],
          });
        },
      );

      it.each([LDMigrationStage.RampDown, LDMigrationStage.Complete])(
        'can report errors for new reads: %p',
        async (stage) => {
          const flagKey = 'migration';
          td.update(td.flag(flagKey).valueForAll(stage));

          await migration.read(flagKey, { key: 'test' }, stage);
          expect(events.length).toBe(2);
          // Only check the measurements component of the event.
          expect(events[1]).toMatchObject({
            measurements: [
              {
                key: 'error',
                values: {
                  old: 0,
                  new: 1,
                },
              },
            ],
          });
        },
      );

      it.each([LDMigrationStage.Shadow, LDMigrationStage.Live])(
        'can report errors for old and new reads simultaneously: %p',
        async (stage) => {
          const flagKey = 'migration';
          td.update(td.flag(flagKey).valueForAll(stage));

          await migration.read(flagKey, { key: 'test' }, stage);
          expect(events.length).toBe(2);
          // Only check the measurements component of the event.
          expect(events[1]).toMatchObject({
            measurements: [
              {
                key: 'error',
                values: {
                  old: 1,
                  new: 1,
                },
              },
            ],
          });
        },
      );

      it.each([LDMigrationStage.Off, LDMigrationStage.DualWrite, LDMigrationStage.Shadow])(
        'can report errors for old writes: %p',
        async (stage) => {
          const flagKey = 'migration';
          td.update(td.flag(flagKey).valueForAll(stage));

          await migration.write(flagKey, { key: 'test' }, stage);
          expect(events.length).toBe(2);
          // Only check the measurements component of the event.
          expect(events[1]).toMatchObject({
            measurements: [
              {
                key: 'error',
                values: {
                  old: 1,
                  new: 0,
                },
              },
            ],
          });
        },
      );

      it.each([LDMigrationStage.Live, LDMigrationStage.RampDown, LDMigrationStage.Complete])(
        'can report errors for new writes: %p',
        async (stage) => {
          const flagKey = 'migration';
          td.update(td.flag(flagKey).valueForAll(stage));

          await migration.write(flagKey, { key: 'test' }, stage);
          expect(events.length).toBe(2);
          // Only check the measurements component of the event.
          expect(events[1]).toMatchObject({
            measurements: [
              {
                key: 'error',
                values: {
                  old: 0,
                  new: 1,
                },
              },
            ],
          });
        },
      );
    });
  });
});

it('ignores invalid measurement keys', () => {
  const inputEvent: LDMigrationOpEvent = {
    kind: 'migration_op',
    operation: 'read',
    creationDate: 0,
    contextKeys: { user: 'bob' },
    evaluation: {
      key: 'potato',
      value: LDMigrationStage.Off,
      default: LDMigrationStage.Live,
      reason: {
        kind: 'FALLTHROUGH',
      },
    },
    measurements: [
      {
        // @ts-ignore
        key: 'bad',
        values: {
          old: 1,
          new: 2,
        },
      },
    ],
  };
  const validatedEvent = MigrationOpEventConversion(inputEvent);
  expect(validatedEvent).toEqual({...inputEvent, measurements: []});
});

it('invalid data types are filtered', () => {
  const inputEvent: LDMigrationOpEvent = {
    kind: 'migration_op',
    operation: 'read',
    creationDate: 0,
    contextKeys: { user: 'bob' },
    evaluation: {
      key: 'potato',
      value: LDMigrationStage.Off,
      default: LDMigrationStage.Live,
      reason: {
        kind: 'FALLTHROUGH',
      },
    },
    measurements: [
      {
        key: 'latency_ms',
        values: {
          // @ts-ignore
          old: 'ham',
          new: 2,
        },
      },
      {
        key: 'consistent',
        // @ts-ignore
        value: undefined
      },
      {
        key: 'error',
        values: {
          // @ts-ignore
          old: {},
          new: 2,
        },
      }
    ],
  };
  const validatedEvent = MigrationOpEventConversion(inputEvent);
  expect(validatedEvent).toEqual({
    kind: 'migration_op',
    operation: 'read',
    creationDate: 0,
    contextKeys: { user: 'bob' },
    evaluation: {
      key: 'potato',
      value: LDMigrationStage.Off,
      default: LDMigrationStage.Live,
      reason: {
        kind: 'FALLTHROUGH',
      },
    },
    measurements: [],
  });
});
