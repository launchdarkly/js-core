import { AsyncQueue } from 'launchdarkly-js-test-helpers';

import { internal } from '@launchdarkly/js-sdk-common';

import {
  LDClientImpl,
  LDConcurrentExecution,
  LDExecutionOrdering,
  LDMigrationOpEvent,
  LDMigrationStage,
  LDSerialExecution,
} from '../src';
import { LDMigration } from '../src/api/LDMigration';
import { TestData } from '../src/integrations';
import { LDClientCallbacks } from '../src/LDClientImpl';
import { createMigration, LDMigrationError, LDMigrationSuccess } from '../src/Migration';
import MigrationOpEventConversion from '../src/MigrationOpEventConversion';
import { createBasicPlatform } from './createBasicPlatform';
import makeCallbacks from './makeCallbacks';

jest.mock('@launchdarkly/js-sdk-common', () => ({
  __esModule: true,
  // @ts-ignore
  ...jest.requireActual('@launchdarkly/js-sdk-common'),
  internal: {
    ...jest.requireActual('@launchdarkly/js-sdk-common').internal,
    shouldSample: jest.fn().mockReturnValue(true),
  },
}));

describe('given an LDClient with test data', () => {
  let client: LDClientImpl;
  let events: AsyncQueue<internal.InputEvent>;
  let td: TestData;
  let callbacks: LDClientCallbacks;

  beforeEach(async () => {
    events = new AsyncQueue<internal.InputEvent>();
    jest
      .spyOn(internal.EventProcessor.prototype, 'sendEvent')
      .mockImplementation((evt) => events.add(evt));

    td = new TestData();
    callbacks = makeCallbacks(false);
    client = new LDClientImpl(
      'sdk-key-migration-op',
      createBasicPlatform(),
      {
        updateProcessor: td.getFactory(),
      },
      callbacks,
    );

    await client.waitForInitialization({ timeout: 10 });
  });

  afterEach(() => {
    client.close();
    events.close();
  });

  describe.each([
    [new LDSerialExecution(LDExecutionOrdering.Fixed), 'serial fixed'],
    [new LDSerialExecution(LDExecutionOrdering.Random), 'serial random'],
    [new LDConcurrentExecution(), 'concurrent'],
  ])('given different execution methods: %p %p', (execution) => {
    describe('given a migration which checks consistency and produces consistent results', () => {
      let migration: LDMigration<string, string>;
      beforeEach(() => {
        migration = createMigration(client, {
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
          jest.spyOn(internal, 'shouldSample').mockReturnValue(true);
          const flagKey = 'migration';
          td.update(td.flag(flagKey).valueForAll(stage));

          await migration.read(flagKey, { key: 'test' }, stage);
          // Feature event.
          await events.take();
          // Migration event.
          const migrationEvent = (await events.take()) as internal.InputMigrationEvent;
          // Only check the measurements component of the event.
          expect(migrationEvent.measurements[1].key).toEqual('consistent');
          // This isn't a precise check, but we should have non-zero values.
          expect(migrationEvent.measurements[1].value).toEqual(true);
        },
      );

      it.each([LDMigrationStage.Shadow, LDMigrationStage.Live])(
        'it uses the check ratio and does a consistency check when it should sample: %p',
        async (stage) => {
          jest.spyOn(internal, 'shouldSample').mockReturnValue(true);
          const flagKey = 'migration';
          td.update(td.flag(flagKey).valueForAll(stage).checkRatio(10));
          // eslint-disable-next-line no-await-in-loop
          await migration.read(flagKey, { key: 'test' }, stage);
          // Feature event.
          await events.take();
          // Migration event.
          const migrationEvent = (await events.take()) as internal.InputMigrationEvent;
          // Only check the measurements component of the event.
          expect(migrationEvent.measurements[1].key).toEqual('consistent');
          // This isn't a precise check, but we should have non-zero values.
          expect(migrationEvent.measurements[1].value).toEqual(true);
          expect(internal.shouldSample).toHaveBeenCalledWith(10);
        },
      );

      it.each([LDMigrationStage.Shadow, LDMigrationStage.Live])(
        'it uses the check ratio and does not do a consistency check when it should not: %p',
        async (stage) => {
          jest.spyOn(internal, 'shouldSample').mockReturnValue(false);
          const flagKey = 'migration';
          td.update(td.flag(flagKey).valueForAll(stage).checkRatio(12));
          // eslint-disable-next-line no-await-in-loop
          await migration.read(flagKey, { key: 'test' }, stage);
          // Feature event.
          await events.take();
          // Migration event.
          const migrationEvent = (await events.take()) as internal.InputMigrationEvent;
          // Only check the measurements component of the event.
          expect(migrationEvent.measurements.length).toEqual(1);
          expect(internal.shouldSample).toHaveBeenCalledWith(12);
        },
      );
    });

    describe('given a migration which checks consistency and produces inconsistent results', () => {
      let migration: LDMigration<string, string>;
      beforeEach(() => {
        migration = createMigration(client, {
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
          jest.spyOn(internal, 'shouldSample').mockReturnValue(true);
          const flagKey = 'migration';
          td.update(td.flag(flagKey).valueForAll(stage));

          await migration.read(flagKey, { key: 'test' }, stage);
          // Feature event.
          await events.take();
          // Migration event.
          const migrationEvent = (await events.take()) as internal.InputMigrationEvent;
          expect(migrationEvent.measurements[1].key).toEqual('consistent');
          // This isn't a precise check, but we should have non-zero values.
          expect(migrationEvent.measurements[1].value).toEqual(false);
        },
      );
    });

    describe('given a migration which takes time to execute and tracks latency', () => {
      let migration: LDMigration<string, string>;

      function timeoutPromise<TReturn>(val: TReturn): Promise<TReturn> {
        return new Promise((a) => {
          setTimeout(() => a(val), 2);
        });
      }

      beforeEach(() => {
        migration = createMigration(client, {
          execution,
          latencyTracking: true,
          errorTracking: false,
          readNew: async () => timeoutPromise(LDMigrationSuccess('readNew')),
          writeNew: async () => timeoutPromise(LDMigrationSuccess('writeNew')),
          readOld: async () => timeoutPromise(LDMigrationSuccess('readOld')),
          writeOld: async () => timeoutPromise(LDMigrationSuccess('writeOld')),
        });
      });

      it.each([
        [LDMigrationStage.Off, { old: true }],
        [LDMigrationStage.DualWrite, { old: true }],
        [LDMigrationStage.Shadow, { old: true, new: true }],
        [LDMigrationStage.RampDown, { new: true }],
        [LDMigrationStage.Complete, { new: true }],
      ])('tracks the invoked methods for reads', async (stage, values) => {
        const flagKey = 'migration';
        td.update(td.flag(flagKey).valueForAll(stage));

        await migration.read(flagKey, { key: 'test' }, stage);
        // Feature event.
        await events.take();
        // Migration event.
        const migrationEvent = (await events.take()) as internal.InputMigrationEvent;
        expect(migrationEvent.measurements[0].key).toEqual('invoked');
        expect(migrationEvent.measurements[0].values).toEqual(values);
      });

      it.each([
        [LDMigrationStage.Off, { old: true }],
        [LDMigrationStage.DualWrite, { old: true, new: true }],
        [LDMigrationStage.Shadow, { old: true, new: true }],
        [LDMigrationStage.RampDown, { old: true, new: true }],
        [LDMigrationStage.Complete, { new: true }],
      ])('tracks the invoked methods for writes', async (stage, values) => {
        const flagKey = 'migration';
        td.update(td.flag(flagKey).valueForAll(stage));

        await migration.write(flagKey, { key: 'test' }, stage);
        // Feature event.
        await events.take();
        // Migration event.
        const migrationEvent = (await events.take()) as internal.InputMigrationEvent;
        expect(migrationEvent.measurements[0].key).toEqual('invoked');
        expect(migrationEvent.measurements[0].values).toEqual(values);
      });

      it.each([LDMigrationStage.Shadow, LDMigrationStage.Live])(
        'can report read latency for new and old',
        async (stage) => {
          const flagKey = 'migration';
          td.update(td.flag(flagKey).valueForAll(stage));

          await migration.read(flagKey, { key: 'test' }, stage);
          // Feature event.
          await events.take();
          // Migration event.
          const migrationEvent = (await events.take()) as internal.InputMigrationEvent;
          expect(migrationEvent.measurements[1].key).toEqual('latency_ms');
          // This isn't a precise check, but we should have non-zero values.
          expect(migrationEvent.measurements[1].values.old).toBeGreaterThanOrEqual(1);
          expect(migrationEvent.measurements[1].values.new).toBeGreaterThanOrEqual(1);
        },
      );

      it.each([LDMigrationStage.Off, LDMigrationStage.DualWrite])(
        'can report latency for old reads',
        async (stage) => {
          const flagKey = 'migration';
          td.update(td.flag(flagKey).valueForAll(stage));

          await migration.read(flagKey, { key: 'test' }, stage);
          // Feature event.
          await events.take();
          // Migration event.
          const migrationEvent = (await events.take()) as internal.InputMigrationEvent;
          expect(migrationEvent.measurements[1].key).toEqual('latency_ms');
          // This isn't a precise check, but we should have non-zero values.
          expect(migrationEvent.measurements[1].values.old).toBeGreaterThanOrEqual(1);
          expect(migrationEvent.measurements[1].values.new).toBeUndefined();
        },
      );

      it.each([LDMigrationStage.RampDown, LDMigrationStage.Complete])(
        'can report latency for new reads',
        async (stage) => {
          const flagKey = 'migration';
          td.update(td.flag(flagKey).valueForAll(stage));

          await migration.read(flagKey, { key: 'test' }, stage);
          // Feature event.
          await events.take();
          // Migration event.
          const migrationEvent = (await events.take()) as internal.InputMigrationEvent;
          expect(migrationEvent.measurements[1].key).toEqual('latency_ms');
          // This isn't a precise check, but we should have non-zero values.
          expect(migrationEvent.measurements[1].values.new).toBeGreaterThanOrEqual(1);
          expect(migrationEvent.measurements[1].values.old).toBeUndefined();
        },
      );

      it.each([LDMigrationStage.Off])('can report latency for old writes: %p', async (stage) => {
        const flagKey = 'migration';
        td.update(td.flag(flagKey).valueForAll(stage));

        await migration.write(flagKey, { key: 'test' }, stage);
        // Feature event.
        await events.take();
        // Migration event.
        const migrationEvent = (await events.take()) as internal.InputMigrationEvent;
        expect(migrationEvent.measurements[1].key).toEqual('latency_ms');
        // This isn't a precise check, but we should have non-zero values.
        expect(migrationEvent.measurements[1].values.old).toBeGreaterThanOrEqual(1);
        expect(migrationEvent.measurements[1].values.new).toBeUndefined();
      });

      it.each([LDMigrationStage.Complete])(
        'can report latency for new writes: %p',
        async (stage) => {
          const flagKey = 'migration';
          td.update(td.flag(flagKey).valueForAll(stage));

          await migration.write(flagKey, { key: 'test' }, stage);
          // Feature event.
          await events.take();
          // Migration event.
          const migrationEvent = (await events.take()) as internal.InputMigrationEvent;
          expect(migrationEvent.measurements[1].key).toEqual('latency_ms');
          // This isn't a precise check, but we should have non-zero values.
          expect(migrationEvent.measurements[1].values.new).toBeGreaterThanOrEqual(1);
          expect(migrationEvent.measurements[1].values.old).toBeUndefined();
        },
      );

      it.each([LDMigrationStage.DualWrite, LDMigrationStage.Shadow, LDMigrationStage.Live])(
        'can report latency for old and new writes: %p',
        async (stage) => {
          const flagKey = 'migration';
          td.update(td.flag(flagKey).valueForAll(stage));

          await migration.write(flagKey, { key: 'test' }, stage);
          // Feature event.
          await events.take();
          // Migration event.
          const migrationEvent = (await events.take()) as internal.InputMigrationEvent;
          expect(migrationEvent.measurements[1].key).toEqual('latency_ms');
          // This isn't a precise check, but we should have non-zero values.
          expect(migrationEvent.measurements[1].values.old).toBeGreaterThanOrEqual(1);
          expect(migrationEvent.measurements[1].values.new).toBeGreaterThanOrEqual(1);
        },
      );

      it('can report write latency for new', async () => {
        const flagKey = 'migration';
        td.update(td.flag(flagKey).valueForAll(LDMigrationStage.Live));

        await migration.write(flagKey, { key: 'test' }, LDMigrationStage.Live);
        // Feature event.
        await events.take();
        // Migration event.
        const migrationEvent = (await events.take()) as internal.InputMigrationEvent;
        expect(migrationEvent.measurements[1].key).toEqual('latency_ms');
        // This isn't a precise check, but we should have non-zero values.
        expect(migrationEvent.measurements[1].values.old).toBeGreaterThanOrEqual(1);
        expect(migrationEvent.measurements[1].values.new).toBeGreaterThanOrEqual(1);
      });
    });

    describe('given a migration which produces errors for every step', () => {
      let migration: LDMigration<string, boolean>;
      beforeEach(() => {
        migration = createMigration<string, boolean>(client, {
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
          // Feature event.
          await events.take();
          // Migration event.
          const migrationEvent = (await events.take()) as internal.InputMigrationEvent;
          // Only check the measurements component of the event.
          expect(migrationEvent.measurements).toContainEqual({
            key: 'error',
            values: {
              old: true,
            },
          });
        },
      );

      it.each([LDMigrationStage.RampDown, LDMigrationStage.Complete])(
        'can report errors for new reads: %p',
        async (stage) => {
          const flagKey = 'migration';
          td.update(td.flag(flagKey).valueForAll(stage));

          await migration.read(flagKey, { key: 'test' }, stage);
          // Feature event.
          await events.take();
          // Migration event.
          const migrationEvent = (await events.take()) as internal.InputMigrationEvent;
          expect(migrationEvent.measurements).toContainEqual({
            key: 'error',
            values: {
              new: true,
            },
          });
        },
      );

      it.each([LDMigrationStage.Shadow, LDMigrationStage.Live])(
        'can report errors for old and new reads simultaneously: %p',
        async (stage) => {
          const flagKey = 'migration';
          td.update(td.flag(flagKey).valueForAll(stage));

          await migration.read(flagKey, { key: 'test' }, stage);
          // Feature event.
          await events.take();
          // Migration event.
          const migrationEvent = (await events.take()) as internal.InputMigrationEvent;
          // Only check the measurements component of the event.
          expect(migrationEvent.measurements).toContainEqual({
            key: 'error',
            values: {
              old: true,
              new: true,
            },
          });
        },
      );

      it.each([LDMigrationStage.Off, LDMigrationStage.DualWrite, LDMigrationStage.Shadow])(
        'can report errors for old writes: %p',
        async (stage) => {
          const flagKey = 'migration';
          td.update(td.flag(flagKey).valueForAll(stage));

          await migration.write(flagKey, { key: 'test' }, stage);
          // Feature event.
          await events.take();
          // Migration event.
          const migrationEvent = (await events.take()) as internal.InputMigrationEvent;
          expect(migrationEvent.measurements).toContainEqual({
            key: 'error',
            values: {
              old: true,
            },
          });
        },
      );

      it.each([LDMigrationStage.Off, LDMigrationStage.DualWrite, LDMigrationStage.Shadow])(
        'it does not invoke non-authoritative write after an error with authoritative old',
        async (stage) => {
          const flagKey = 'migration';
          td.update(td.flag(flagKey).valueForAll(stage));

          await migration.write(flagKey, { key: 'test' }, stage);
          // Feature event.
          await events.take();
          // Migration event.
          const migrationEvent = (await events.take()) as internal.InputMigrationEvent;
          expect(migrationEvent.measurements[0].key).toEqual('invoked');
          expect(migrationEvent.measurements[0].values).toEqual({ old: true });
        },
      );

      it.each([LDMigrationStage.Live, LDMigrationStage.RampDown, LDMigrationStage.Complete])(
        'it does not invoke non-authoritative write after an error with authoritative new',
        async (stage) => {
          const flagKey = 'migration';
          td.update(td.flag(flagKey).valueForAll(stage));

          await migration.write(flagKey, { key: 'test' }, stage);
          // Feature event.
          await events.take();
          // Migration event.
          const migrationEvent = (await events.take()) as internal.InputMigrationEvent;
          expect(migrationEvent.measurements[0].key).toEqual('invoked');
          expect(migrationEvent.measurements[0].values).toEqual({ new: true });
        },
      );

      it.each([LDMigrationStage.Live, LDMigrationStage.RampDown, LDMigrationStage.Complete])(
        'can report errors for new writes: %p',
        async (stage) => {
          const flagKey = 'migration';
          td.update(td.flag(flagKey).valueForAll(stage));

          await migration.write(flagKey, { key: 'test' }, stage);
          // Feature event.
          await events.take();
          // Migration event.
          const migrationEvent = (await events.take()) as internal.InputMigrationEvent;
          // Only check the measurements component of the event.
          expect(migrationEvent.measurements).toContainEqual({
            key: 'error',
            values: {
              new: true,
            },
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
          old: true,
        },
      },
    ],
  };
  const validatedEvent = MigrationOpEventConversion(inputEvent);
  expect(validatedEvent).toEqual({ ...inputEvent, measurements: [], samplingRatio: 1 });
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
        value: undefined,
      },
      {
        key: 'error',
        values: {
          // @ts-ignore
          old: {},
          new: true,
        },
      },
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
    samplingRatio: 1,
  });
});
