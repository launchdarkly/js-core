import { Context } from '@launchdarkly/js-sdk-common';

import { LDConsistencyCheck, LDMigrationStage } from '../src';
import MigrationOpTracker from '../src/MigrationOpTracker';

it('does not generate an event if an op is not set', () => {
  const tracker = new MigrationOpTracker(
    'flag',
    Context.fromLDContext({ kind: 'user', key: 'bob' }),
    LDMigrationStage.Off,
    LDMigrationStage.Off,
    {
      kind: 'FALLTHROUGH',
    },
  );

  expect(tracker.createEvent()).toBeUndefined();
});

it('does not generate an event for an invalid context', () => {
  const tracker = new MigrationOpTracker(
    'flag',
    Context.fromLDContext({ kind: 'kind', key: '' }),
    LDMigrationStage.Off,
    LDMigrationStage.Off,
    {
      kind: 'FALLTHROUGH',
    },
  );

  // Set the op otherwise that would prevent an event as well.
  tracker.op('write');

  expect(tracker.createEvent()).toBeUndefined();
});

it('generates an event if the minimal requirements are met.', () => {
  const tracker = new MigrationOpTracker(
    'flag',
    Context.fromLDContext({ kind: 'user', key: 'bob' }),
    LDMigrationStage.Off,
    LDMigrationStage.Off,
    {
      kind: 'FALLTHROUGH',
    },
  );

  tracker.op('write');

  expect(tracker.createEvent()).toMatchObject({
    contextKeys: { user: 'bob' },
    evaluation: { default: 'off', key: 'flag', reason: { kind: 'FALLTHROUGH' }, value: 'off' },
    kind: 'migration_op',
    measurements: [],
    operation: 'write',
  });
});

it('includes errors if at least one is set', () => {
  const tracker = new MigrationOpTracker(
    'flag',
    Context.fromLDContext({ kind: 'user', key: 'bob' }),
    LDMigrationStage.Off,
    LDMigrationStage.Off,
    {
      kind: 'FALLTHROUGH',
    },
  );
  tracker.op('read');
  tracker.error('old');

  const event = tracker.createEvent();
  expect(event?.measurements).toContainEqual({
    key: 'error',
    values: {
      old: 1,
      new: 0,
    },
  });

  const trackerB = new MigrationOpTracker(
    'flag',
    Context.fromLDContext({ kind: 'user', key: 'bob' }),
    LDMigrationStage.Off,
    LDMigrationStage.Off,
    {
      kind: 'FALLTHROUGH',
    },
  );
  trackerB.op('read');
  trackerB.error('new');

  const eventB = trackerB.createEvent();
  expect(eventB?.measurements).toContainEqual({
    key: 'error',
    values: {
      old: 0,
      new: 1,
    },
  });
});

it('includes latency if at least one measurement exists', () => {
  const tracker = new MigrationOpTracker(
    'flag',
    Context.fromLDContext({ kind: 'user', key: 'bob' }),
    LDMigrationStage.Off,
    LDMigrationStage.Off,
    {
      kind: 'FALLTHROUGH',
    },
  );
  tracker.op('read');
  tracker.latency('old', 100);

  const event = tracker.createEvent();
  expect(event?.measurements).toContainEqual({
    key: 'latency',
    values: {
      old: 100,
    },
  });

  const trackerB = new MigrationOpTracker(
    'flag',
    Context.fromLDContext({ kind: 'user', key: 'bob' }),
    LDMigrationStage.Off,
    LDMigrationStage.Off,
    {
      kind: 'FALLTHROUGH',
    },
  );
  trackerB.op('read');
  trackerB.latency('new', 150);

  const eventB = trackerB.createEvent();
  expect(eventB?.measurements).toContainEqual({
    key: 'latency',
    values: {
      new: 150,
    },
  });
});

it('includes if the result was consistent', () => {
  const tracker = new MigrationOpTracker(
    'flag',
    Context.fromLDContext({ kind: 'user', key: 'bob' }),
    LDMigrationStage.Off,
    LDMigrationStage.Off,
    {
      kind: 'FALLTHROUGH',
    },
  );
  tracker.op('read');
  tracker.consistency(LDConsistencyCheck.Consistent);

  const event = tracker.createEvent();
  expect(event?.measurements).toContainEqual({
    key: 'consistent',
    value: 1,
    samplingOdds: 0,
  });
});

it('includes if the result was inconsistent', () => {
  const tracker = new MigrationOpTracker(
    'flag',
    Context.fromLDContext({ kind: 'user', key: 'bob' }),
    LDMigrationStage.Off,
    LDMigrationStage.Off,
    {
      kind: 'FALLTHROUGH',
    },
  );
  tracker.op('read');
  tracker.consistency(LDConsistencyCheck.Inconsistent);

  const event = tracker.createEvent();
  expect(event?.measurements).toContainEqual({
    key: 'consistent',
    value: 0,
    samplingOdds: 0,
  });
});
