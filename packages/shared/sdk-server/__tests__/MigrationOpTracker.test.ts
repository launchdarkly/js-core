import { LDContext, LDMigrationStage } from '../src';
import { LDMigrationOrigin } from '../src/api/LDMigration';
import MigrationOpTracker from '../src/MigrationOpTracker';
import TestLogger, { LogLevel } from './Logger';

it('does not generate an event if an op is not set', () => {
  const tracker = new MigrationOpTracker(
    'flag',
    { key: 'user-key' },
    LDMigrationStage.Off,
    LDMigrationStage.Off,
    {
      kind: 'FALLTHROUGH',
    },
  );

  tracker.invoked('old');

  expect(tracker.createEvent()).toBeUndefined();
});

it('does not generate an event with missing context keys', () => {
  const tracker = new MigrationOpTracker(
    'flag',
    {} as LDContext,
    LDMigrationStage.Off,
    LDMigrationStage.Off,
    {
      kind: 'FALLTHROUGH',
    },
  );

  // Set the op otherwise/invoked that would prevent an event as well.
  tracker.op('write');
  tracker.invoked('old');

  expect(tracker.createEvent()).toBeUndefined();
});

it('does not generate an event with empty flag key', () => {
  const tracker = new MigrationOpTracker(
    '',
    { key: 'user-key' },
    LDMigrationStage.Off,
    LDMigrationStage.Off,
    {
      kind: 'FALLTHROUGH',
    },
  );

  // Set the op/invoked otherwise that would prevent an event as well.
  tracker.op('write');
  tracker.invoked('old');

  expect(tracker.createEvent()).toBeUndefined();
});

it('generates an event if the minimal requirements are met.', () => {
  const tracker = new MigrationOpTracker(
    'flag',
    { key: 'user-key' },
    LDMigrationStage.Off,
    LDMigrationStage.Off,
    {
      kind: 'FALLTHROUGH',
    },
  );

  tracker.op('write');
  tracker.invoked('old');

  expect(tracker.createEvent()).toMatchObject({
    context: { key: 'user-key' },
    evaluation: { default: 'off', key: 'flag', reason: { kind: 'FALLTHROUGH' }, value: 'off' },
    kind: 'migration_op',
    measurements: [
      {
        key: 'invoked',
        values: {
          old: true,
        },
      },
    ],
    operation: 'write',
  });
});

it('can include the variation in the event', () => {
  const tracker = new MigrationOpTracker(
    'flag',
    { key: 'user-key' },
    LDMigrationStage.Off,
    LDMigrationStage.Off,
    {
      kind: 'FALLTHROUGH',
    },
    undefined,
    1,
  );

  tracker.op('write');
  tracker.invoked('old');

  expect(tracker.createEvent()).toMatchObject({
    context: { key: 'user-key' },
    evaluation: {
      default: 'off',
      key: 'flag',
      reason: { kind: 'FALLTHROUGH' },
      value: 'off',
      variation: 1,
    },
    kind: 'migration_op',
    measurements: [
      {
        key: 'invoked',
        values: {
          old: true,
        },
      },
    ],
    operation: 'write',
  });
});

it('can include the version in the event', () => {
  const tracker = new MigrationOpTracker(
    'flag',
    { key: 'user-key' },
    LDMigrationStage.Off,
    LDMigrationStage.Off,
    {
      kind: 'FALLTHROUGH',
    },
    undefined,
    undefined,
    2,
  );

  tracker.op('write');
  tracker.invoked('old');

  expect(tracker.createEvent()).toMatchObject({
    context: { key: 'user-key' },
    evaluation: {
      default: 'off',
      key: 'flag',
      reason: { kind: 'FALLTHROUGH' },
      value: 'off',
      version: 2,
    },
    kind: 'migration_op',
    measurements: [
      {
        key: 'invoked',
        values: {
          old: true,
        },
      },
    ],
    operation: 'write',
  });
});

it('includes errors if at least one is set', () => {
  const tracker = new MigrationOpTracker(
    'flag',
    { key: 'user-key' },
    LDMigrationStage.Off,
    LDMigrationStage.Off,
    {
      kind: 'FALLTHROUGH',
    },
  );
  tracker.op('read');
  tracker.error('old');
  tracker.invoked('old');
  tracker.invoked('new');

  const event = tracker.createEvent();
  expect(event?.measurements).toContainEqual({
    key: 'error',
    values: {
      old: true,
    },
  });

  const trackerB = new MigrationOpTracker(
    'flag',
    { key: 'user-key' },
    LDMigrationStage.Off,
    LDMigrationStage.Off,
    {
      kind: 'FALLTHROUGH',
    },
  );
  trackerB.op('read');
  trackerB.error('new');
  trackerB.invoked('old');
  trackerB.invoked('new');

  const eventB = trackerB.createEvent();
  expect(eventB?.measurements).toContainEqual({
    key: 'error',
    values: {
      new: true,
    },
  });
});

it('includes latency if at least one measurement exists', () => {
  const tracker = new MigrationOpTracker(
    'flag',
    { key: 'user-key' },
    LDMigrationStage.Off,
    LDMigrationStage.Off,
    {
      kind: 'FALLTHROUGH',
    },
  );
  tracker.op('read');
  tracker.latency('old', 100);
  tracker.invoked('old');
  tracker.invoked('new');

  const event = tracker.createEvent();
  expect(event?.measurements).toContainEqual({
    key: 'latency_ms',
    values: {
      old: 100,
    },
  });

  const trackerB = new MigrationOpTracker(
    'flag',
    { key: 'user-key' },
    LDMigrationStage.Off,
    LDMigrationStage.Off,
    {
      kind: 'FALLTHROUGH',
    },
  );
  trackerB.op('read');
  trackerB.latency('new', 150);
  trackerB.invoked('old');
  trackerB.invoked('new');

  const eventB = trackerB.createEvent();
  expect(eventB?.measurements).toContainEqual({
    key: 'latency_ms',
    values: {
      new: 150,
    },
  });
});

it('includes if the result was consistent', () => {
  const tracker = new MigrationOpTracker(
    'flag',
    { key: 'user-key' },
    LDMigrationStage.Off,
    LDMigrationStage.Off,
    {
      kind: 'FALLTHROUGH',
    },
  );
  tracker.op('read');
  tracker.consistency(() => true);
  tracker.invoked('old');
  tracker.invoked('new');

  const event = tracker.createEvent();
  expect(event?.measurements).toContainEqual({
    key: 'consistent',
    value: true,
    samplingRatio: 1,
  });
});

it('includes if the result was inconsistent', () => {
  const tracker = new MigrationOpTracker(
    'flag',
    { key: 'user-key' },
    LDMigrationStage.Off,
    LDMigrationStage.Off,
    {
      kind: 'FALLTHROUGH',
    },
  );
  tracker.op('read');
  tracker.invoked('old');
  tracker.invoked('new');
  tracker.consistency(() => false);

  const event = tracker.createEvent();
  expect(event?.measurements).toContainEqual({
    key: 'consistent',
    value: false,
    samplingRatio: 1,
  });
});

it.each(['old', 'new'])('includes which single origins were invoked', (origin) => {
  const tracker = new MigrationOpTracker(
    'flag',
    { key: 'user-key' },
    LDMigrationStage.Off,
    LDMigrationStage.Off,
    {
      kind: 'FALLTHROUGH',
    },
  );
  tracker.op('read');
  tracker.invoked(origin as LDMigrationOrigin);

  const event = tracker.createEvent();
  expect(event?.measurements).toContainEqual({
    key: 'invoked',
    values: { [origin]: true },
  });
});

it('includes when both origins were invoked', () => {
  const tracker = new MigrationOpTracker(
    'flag',
    { key: 'user-key' },
    LDMigrationStage.Off,
    LDMigrationStage.Off,
    {
      kind: 'FALLTHROUGH',
    },
  );
  tracker.op('read');
  tracker.invoked('old');
  tracker.invoked('new');

  const event = tracker.createEvent();
  expect(event?.measurements).toContainEqual({
    key: 'invoked',
    values: { old: true, new: true },
  });
});

it('can handle exceptions thrown in the consistency check method', () => {
  const logger = new TestLogger();
  const tracker = new MigrationOpTracker(
    'flag',
    { key: 'user-key' },
    LDMigrationStage.Off,
    LDMigrationStage.Off,
    {
      kind: 'FALLTHROUGH',
    },
    undefined,
    undefined,
    undefined,
    undefined,
    logger,
  );
  tracker.op('read');
  tracker.invoked('old');
  tracker.invoked('new');
  tracker.consistency(() => {
    throw new Error('I HAVE FAILED');
  });
  logger.expectMessages([
    {
      level: LogLevel.Error,
      matches: /.*migration 'flag'.*Error: I HAVE FAILED/,
    },
  ]);
});

it.each([
  [false, true, true, false],
  [true, false, false, true],
  [false, true, true, true],
  [true, false, true, true],
])(
  'does not generate an event if latency measurement without correct invoked measurement' +
    ' invoke old: %p invoke new: %p measure old: %p measure new: %p',
  (invoke_old, invoke_new, measure_old, measure_new) => {
    const tracker = new MigrationOpTracker(
      'flag',
      { key: 'user-key' },
      LDMigrationStage.Off,
      LDMigrationStage.Off,
      {
        kind: 'FALLTHROUGH',
      },
    );

    tracker.op('write');
    if (invoke_old) {
      tracker.invoked('old');
    }
    if (invoke_new) {
      tracker.invoked('new');
    }
    if (measure_old) {
      tracker.latency('old', 100);
    }
    if (measure_new) {
      tracker.latency('new', 100);
    }

    expect(tracker.createEvent()).toBeUndefined();
  },
);

it.each([
  [false, true, true, false],
  [true, false, false, true],
  [false, true, true, true],
  [true, false, true, true],
])(
  'does not generate an event error measurement without correct invoked measurement' +
    ' invoke old: %p invoke new: %p measure old: %p measure new: %p',
  (invoke_old, invoke_new, measure_old, measure_new) => {
    const tracker = new MigrationOpTracker(
      'flag',
      { key: 'user-key' },
      LDMigrationStage.Off,
      LDMigrationStage.Off,
      {
        kind: 'FALLTHROUGH',
      },
    );

    tracker.op('write');
    if (invoke_old) {
      tracker.invoked('old');
    }
    if (invoke_new) {
      tracker.invoked('new');
    }
    if (measure_old) {
      tracker.error('old');
    }
    if (measure_new) {
      tracker.error('new');
    }

    expect(tracker.createEvent()).toBeUndefined();
  },
);

it.each([
  [true, false, true],
  [false, true, true],
  [true, false, false],
  [false, true, false],
])(
  'does not generate an event if there is a consistency measurement but both origins were not invoked' +
    ' invoke old: %p invoke new: %p consistent: %p',
  (invoke_old, invoke_new, consistent) => {
    const tracker = new MigrationOpTracker(
      'flag',
      { key: 'user-key' },
      LDMigrationStage.Off,
      LDMigrationStage.Off,
      {
        kind: 'FALLTHROUGH',
      },
    );

    tracker.op('write');
    if (invoke_old) {
      tracker.invoked('old');
    }
    if (invoke_new) {
      tracker.invoked('new');
    }
    tracker.consistency(() => consistent);
    expect(tracker.createEvent()).toBeUndefined();
  },
);
