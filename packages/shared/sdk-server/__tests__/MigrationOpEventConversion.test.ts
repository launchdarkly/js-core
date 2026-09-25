import { LDContext, LDMigrationOpEvent, LDMigrationStage } from '../src';
import migrationOpEventToInputEvent from '../src/MigrationOpEventConversion';

const baseEvent: LDMigrationOpEvent = {
  kind: 'migration_op',
  operation: 'read',
  creationDate: new Date().getTime(),
  evaluation: {
    default: LDMigrationStage.Off,
    key: 'flag',
    reason: { kind: 'FALLTHROUGH' },
    value: LDMigrationStage.Off,
  },
  measurements: [],
  samplingRatio: 1,
};

it('handles event without either context or contextKeys', () => {
  expect(migrationOpEventToInputEvent(baseEvent)).toBeUndefined();
});

it('handles event with only context', () => {
  const outEvent = migrationOpEventToInputEvent({
    ...baseEvent,
    context: { key: 'user-key' },
  });
  expect(outEvent).toBeDefined();
  expect(outEvent?.context?.key()).toEqual('user-key');
  expect(outEvent?.context?.kind).toEqual('user');
  expect(outEvent?.contextKeys).toBeUndefined();
});

it('handles event with only contextKeys', () => {
  const outEvent = migrationOpEventToInputEvent({
    ...baseEvent,
    contextKeys: { user: 'bob' },
  });
  expect(outEvent).toBeDefined();
  expect(outEvent?.context).toBeUndefined();
  expect(outEvent?.contextKeys).toEqual({ user: 'bob' });
});

it('handles invalid context', () => {
  const outEvent = migrationOpEventToInputEvent({
    ...baseEvent,
    context: {} as LDContext,
  });
  expect(outEvent).toBeUndefined();
});

it('handles invalid context even if contextKeys is provided', () => {
  const outEvent = migrationOpEventToInputEvent({
    ...baseEvent,
    context: {} as LDContext,
    contextKeys: { user: 'bob' },
  });
  expect(outEvent).toBeUndefined();
});

it('handles invalid key in contextKeys', () => {
  const outEvent = migrationOpEventToInputEvent({
    ...baseEvent,
    contextKeys: { kind: 'user' },
  });
  expect(outEvent).toBeUndefined();
});

it('handles invalid value in contextKeys', () => {
  const outEvent = migrationOpEventToInputEvent({
    ...baseEvent,
    contextKeys: { user: '' },
  });
  expect(outEvent).toBeUndefined();
});

it('uses context if both context and contextKeys are provided', () => {
  const outEvent = migrationOpEventToInputEvent({
    ...baseEvent,
    context: { key: 'user-key' },
    contextKeys: { user: 'bob' },
  });
  expect(outEvent).toBeDefined();
  expect(outEvent?.context?.key()).toEqual('user-key');
  expect(outEvent?.context?.kind).toEqual('user');
  expect(outEvent?.contextKeys).toBeUndefined();
});

it('keeps the override affected indicator on the evaluation reason', () => {
  const outEvent = migrationOpEventToInputEvent({
    ...baseEvent,
    context: { key: 'user-key' },
    evaluation: {
      ...baseEvent.evaluation,
      reason: { kind: 'FALLTHROUGH', overrideAffected: true },
    },
  });
  expect(outEvent?.evaluation.reason).toEqual({ kind: 'FALLTHROUGH', overrideAffected: true });
});

it('drops an override affected indicator that is not a boolean', () => {
  const outEvent = migrationOpEventToInputEvent({
    ...baseEvent,
    context: { key: 'user-key' },
    evaluation: {
      ...baseEvent.evaluation,
      reason: { kind: 'FALLTHROUGH', overrideAffected: 'yes' as unknown as boolean },
    },
  });
  expect(outEvent?.evaluation.reason).toEqual({ kind: 'FALLTHROUGH' });
});
