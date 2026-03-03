import { DataSourceErrorKind } from '@launchdarkly/js-sdk-common';

import {
  createConditionGroup,
  createFallbackCondition,
  createRecoveryCondition,
  getConditions,
} from '../../../src/datasource/fdv2/Conditions';
import {
  changeSet,
  FDv2SourceResult,
  interrupted,
  shutdown,
} from '../../../src/datasource/fdv2/FDv2SourceResult';

const DID_NOT_RESOLVE = Symbol('did-not-resolve');

/**
 * Race a promise against a timeout. Returns DID_NOT_RESOLVE if the promise
 * does not settle within the given time.
 */
function raceTimeout<T>(promise: Promise<T>, ms: number): Promise<T | typeof DID_NOT_RESOLVE> {
  return Promise.race([
    promise,
    new Promise<typeof DID_NOT_RESOLVE>((resolve) => {
      setTimeout(() => resolve(DID_NOT_RESOLVE), ms);
    }),
  ]);
}

function makeInterrupted(): FDv2SourceResult {
  return interrupted(
    { kind: DataSourceErrorKind.NetworkError, message: 'test error', time: Date.now() },
    false,
  );
}

function makeChangeSet(): FDv2SourceResult {
  return changeSet(
    { id: 'test', version: 1, state: 'test-state', type: 'full', updates: [] },
    false,
  );
}

// -- fallback condition --

it('fallback condition does not fire without an interrupted result', async () => {
  const condition = createFallbackCondition(10);
  expect(await raceTimeout(condition.promise, 50)).toBe(DID_NOT_RESOLVE);
  condition.close();
});

it('fallback condition fires after timeout following an interrupted result', async () => {
  const condition = createFallbackCondition(10);
  condition.inform(makeInterrupted());
  expect(await condition.promise).toBe('fallback');
  condition.close();
});

it('fallback condition cancels timer when a changeSet is received', async () => {
  const condition = createFallbackCondition(10);
  condition.inform(makeInterrupted());
  condition.inform(makeChangeSet());
  expect(await raceTimeout(condition.promise, 50)).toBe(DID_NOT_RESOLVE);
  condition.close();
});

it('fallback condition restarts timer after cancellation by changeSet', async () => {
  const condition = createFallbackCondition(10);
  condition.inform(makeInterrupted());
  condition.inform(makeChangeSet());
  condition.inform(makeInterrupted());
  expect(await condition.promise).toBe('fallback');
  condition.close();
});

it('fallback condition does not start a second timer for duplicate interrupted results', async () => {
  const condition = createFallbackCondition(10);
  condition.inform(makeInterrupted());
  condition.inform(makeInterrupted());
  expect(await condition.promise).toBe('fallback');
  condition.close();
});

it('fallback condition does not fire after close', async () => {
  const condition = createFallbackCondition(10);
  condition.inform(makeInterrupted());
  condition.close();
  expect(await raceTimeout(condition.promise, 50)).toBe(DID_NOT_RESOLVE);
});

it('fallback condition ignores inform after close', () => {
  const condition = createFallbackCondition(10);
  condition.close();
  // Should not throw
  condition.inform(makeInterrupted());
  condition.inform(makeChangeSet());
});

// -- recovery condition --

it('recovery condition fires after timeout', async () => {
  const condition = createRecoveryCondition(10);
  expect(await condition.promise).toBe('recovery');
  condition.close();
});

it('recovery condition ignores inform calls', async () => {
  const condition = createRecoveryCondition(10);
  condition.inform(makeInterrupted());
  condition.inform(makeChangeSet());
  condition.inform(shutdown());
  expect(await condition.promise).toBe('recovery');
  condition.close();
});

it('recovery condition does not fire after close', async () => {
  const condition = createRecoveryCondition(10);
  condition.close();
  expect(await raceTimeout(condition.promise, 50)).toBe(DID_NOT_RESOLVE);
});

// -- condition group --

it('condition group returns undefined promise for empty group', () => {
  const group = createConditionGroup([]);
  expect(group.promise).toBeUndefined();
});

it('condition group races conditions and resolves with the first to fire', async () => {
  const fallback = createFallbackCondition(10);
  const recovery = createRecoveryCondition(200);
  const group = createConditionGroup([fallback, recovery]);

  expect(group.promise).toBeDefined();
  group.inform(makeInterrupted());

  expect(await group.promise).toBe('fallback');
  group.close();
});

it('condition group resolves with recovery when no interrupted result is received', async () => {
  const fallback = createFallbackCondition(200);
  const recovery = createRecoveryCondition(10);
  const group = createConditionGroup([fallback, recovery]);

  expect(await group.promise).toBe('recovery');
  group.close();
});

it('condition group broadcasts inform to all conditions', async () => {
  const fallback = createFallbackCondition(10);
  const recovery = createRecoveryCondition(200);
  const group = createConditionGroup([fallback, recovery]);

  group.inform(makeInterrupted());

  expect(await group.promise).toBe('fallback');
  group.close();
});

it('condition group close stops all conditions', async () => {
  const fallback = createFallbackCondition(10);
  const recovery = createRecoveryCondition(10);
  const group = createConditionGroup([fallback, recovery]);

  group.inform(makeInterrupted());
  group.close();

  expect(await raceTimeout(group.promise!, 50)).toBe(DID_NOT_RESOLVE);
});

// -- getConditions --

it('getConditions returns empty group when only one synchronizer is available', () => {
  const group = getConditions(1, true, 10, 10);
  expect(group.promise).toBeUndefined();
});

it('getConditions returns empty group when zero synchronizers are available', () => {
  const group = getConditions(0, true, 10, 10);
  expect(group.promise).toBeUndefined();
});

it('getConditions returns fallback only for prime synchronizer', async () => {
  const group = getConditions(2, true, 10, 200);

  group.inform(makeInterrupted());

  expect(await group.promise).toBe('fallback');
  group.close();
});

it('getConditions returns fallback and recovery for non-prime synchronizer', async () => {
  const group = getConditions(2, false, 200, 10);

  expect(await group.promise).toBe('recovery');
  group.close();
});
