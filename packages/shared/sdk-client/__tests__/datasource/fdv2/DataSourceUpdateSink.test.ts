import { Context, internal } from '@launchdarkly/js-sdk-common';

import { createDataSourceUpdateSink } from '../../../src/datasource/fdv2/DataSourceUpdateSink';
import { ChangeSetResult } from '../../../src/datasource/fdv2/FDv2SourceResult';
import { FlagManager } from '../../../src/flag-manager/FlagManager';
import { makeLogger } from './orchestrationTestHelpers';

function makeContext(key: string = 'user-key'): Context {
  return Context.fromLDContext({ kind: 'user', key });
}

function makeFlagManager(): jest.Mocked<Pick<FlagManager, 'init' | 'upsert' | 'get' | 'getAll'>> {
  return {
    init: jest.fn().mockResolvedValue(undefined),
    upsert: jest.fn().mockResolvedValue(true),
    get: jest.fn(),
    getAll: jest.fn(),
  };
}

function makeResult(
  payload: internal.Payload,
  opts: { fdv1Fallback?: boolean; environmentId?: string } = {},
): ChangeSetResult {
  return {
    type: 'changeSet',
    payload,
    fdv1Fallback: opts.fdv1Fallback ?? false,
    environmentId: opts.environmentId,
  };
}

function makePayload(overrides: Partial<internal.Payload> = {}): internal.Payload {
  return {
    id: 'test-payload',
    version: 1,
    state: 'test-selector',
    type: 'full',
    updates: [],
    ...overrides,
  };
}

function makeFlagEvalUpdate(
  key: string,
  version: number,
  value: unknown,
  opts: { deleted?: boolean } = {},
): internal.Update {
  if (opts.deleted) {
    return { kind: 'flagEval', key, version, deleted: true };
  }
  return {
    kind: 'flagEval',
    key,
    version,
    object: { value, trackEvents: false },
  };
}

// -- full payload --

it('calls flagManager.init with converted descriptors on full payload', () => {
  const flagManager = makeFlagManager();
  const context = makeContext();

  const sink = createDataSourceUpdateSink({
    flagManager: flagManager as unknown as FlagManager,
    contextGetter: () => context,
  });

  const payload = makePayload({
    type: 'full',
    updates: [makeFlagEvalUpdate('flag-1', 10, true), makeFlagEvalUpdate('flag-2', 20, 'hello')],
  });

  sink.handleChangeSet(makeResult(payload));

  expect(flagManager.init).toHaveBeenCalledTimes(1);
  expect(flagManager.init).toHaveBeenCalledWith(context, {
    'flag-1': {
      version: 10,
      flag: { value: true, trackEvents: false, version: 10 },
    },
    'flag-2': {
      version: 20,
      flag: { value: 'hello', trackEvents: false, version: 20 },
    },
  });
  expect(flagManager.upsert).not.toHaveBeenCalled();
});

// -- partial payload --

it('calls flagManager.upsert for each flag on partial payload', () => {
  const flagManager = makeFlagManager();
  const context = makeContext();

  const sink = createDataSourceUpdateSink({
    flagManager: flagManager as unknown as FlagManager,
    contextGetter: () => context,
  });

  const payload = makePayload({
    type: 'partial',
    updates: [makeFlagEvalUpdate('flag-a', 5, 42), makeFlagEvalUpdate('flag-b', 6, false)],
  });

  sink.handleChangeSet(makeResult(payload));

  expect(flagManager.upsert).toHaveBeenCalledTimes(2);
  expect(flagManager.upsert).toHaveBeenCalledWith(context, 'flag-a', {
    version: 5,
    flag: { value: 42, trackEvents: false, version: 5 },
  });
  expect(flagManager.upsert).toHaveBeenCalledWith(context, 'flag-b', {
    version: 6,
    flag: { value: false, trackEvents: false, version: 6 },
  });
  expect(flagManager.init).not.toHaveBeenCalled();
});

// -- none payload --

it('does not call flagManager on none payload', () => {
  const flagManager = makeFlagManager();

  const sink = createDataSourceUpdateSink({
    flagManager: flagManager as unknown as FlagManager,
    contextGetter: () => makeContext(),
  });

  sink.handleChangeSet(makeResult(makePayload({ type: 'none', updates: [] })));

  expect(flagManager.init).not.toHaveBeenCalled();
  expect(flagManager.upsert).not.toHaveBeenCalled();
});

// -- selector management --

it('stores selector from payload state', () => {
  const flagManager = makeFlagManager();

  const sink = createDataSourceUpdateSink({
    flagManager: flagManager as unknown as FlagManager,
    contextGetter: () => makeContext(),
  });

  expect(sink.getSelector()).toBeUndefined();

  sink.handleChangeSet(makeResult(makePayload({ state: 'selector-1' })));

  expect(sink.getSelector()).toBe('selector-1');
});

it('updates selector on subsequent payloads', () => {
  const flagManager = makeFlagManager();

  const sink = createDataSourceUpdateSink({
    flagManager: flagManager as unknown as FlagManager,
    contextGetter: () => makeContext(),
  });

  sink.handleChangeSet(makeResult(makePayload({ state: 'a' })));
  sink.handleChangeSet(makeResult(makePayload({ state: 'b' })));

  expect(sink.getSelector()).toBe('b');
});

it('does not clear selector when payload has no state', () => {
  const flagManager = makeFlagManager();

  const sink = createDataSourceUpdateSink({
    flagManager: flagManager as unknown as FlagManager,
    contextGetter: () => makeContext(),
  });

  sink.handleChangeSet(makeResult(makePayload({ state: 'a' })));
  sink.handleChangeSet(makeResult(makePayload({ state: undefined })));

  expect(sink.getSelector()).toBe('a');
});

it('does not set selector from empty string state', () => {
  const flagManager = makeFlagManager();

  const sink = createDataSourceUpdateSink({
    flagManager: flagManager as unknown as FlagManager,
    contextGetter: () => makeContext(),
  });

  sink.handleChangeSet(makeResult(makePayload({ state: '' })));

  expect(sink.getSelector()).toBeUndefined();
});

// -- environmentId tracking --

it('tracks environmentId from ChangeSetResult', () => {
  const flagManager = makeFlagManager();

  const sink = createDataSourceUpdateSink({
    flagManager: flagManager as unknown as FlagManager,
    contextGetter: () => makeContext(),
  });

  expect(sink.getEnvironmentId()).toBeUndefined();

  sink.handleChangeSet(makeResult(makePayload(), { environmentId: 'env-123' }));

  expect(sink.getEnvironmentId()).toBe('env-123');
});

it('updates environmentId on subsequent results', () => {
  const flagManager = makeFlagManager();

  const sink = createDataSourceUpdateSink({
    flagManager: flagManager as unknown as FlagManager,
    contextGetter: () => makeContext(),
  });

  sink.handleChangeSet(makeResult(makePayload(), { environmentId: 'env-1' }));
  sink.handleChangeSet(makeResult(makePayload(), { environmentId: 'env-2' }));

  expect(sink.getEnvironmentId()).toBe('env-2');
});

// -- non-flagEval kinds --

it('ignores non-flagEval update kinds', () => {
  const flagManager = makeFlagManager();

  const sink = createDataSourceUpdateSink({
    flagManager: flagManager as unknown as FlagManager,
    contextGetter: () => makeContext(),
  });

  const payload = makePayload({
    type: 'full',
    updates: [
      { kind: 'segment', key: 'seg-1', version: 1, object: {} },
      { kind: 'unknown', key: 'unk-1', version: 1, object: {} },
    ],
  });

  sink.handleChangeSet(makeResult(payload));

  expect(flagManager.init).toHaveBeenCalledWith(expect.anything(), {});
});

// -- delete handling --

it('handles delete updates in full payload', () => {
  const flagManager = makeFlagManager();
  const context = makeContext();

  const sink = createDataSourceUpdateSink({
    flagManager: flagManager as unknown as FlagManager,
    contextGetter: () => context,
  });

  const payload = makePayload({
    type: 'full',
    updates: [makeFlagEvalUpdate('deleted-flag', 7, undefined, { deleted: true })],
  });

  sink.handleChangeSet(makeResult(payload));

  expect(flagManager.init).toHaveBeenCalledWith(context, {
    'deleted-flag': {
      version: 7,
      flag: {
        version: 7,
        deleted: true,
        value: undefined,
        trackEvents: false,
      },
    },
  });
});

it('handles delete updates in partial payload', () => {
  const flagManager = makeFlagManager();
  const context = makeContext();

  const sink = createDataSourceUpdateSink({
    flagManager: flagManager as unknown as FlagManager,
    contextGetter: () => context,
  });

  const payload = makePayload({
    type: 'partial',
    updates: [makeFlagEvalUpdate('deleted-flag', 7, undefined, { deleted: true })],
  });

  sink.handleChangeSet(makeResult(payload));

  expect(flagManager.upsert).toHaveBeenCalledWith(context, 'deleted-flag', {
    version: 7,
    flag: {
      version: 7,
      deleted: true,
      value: undefined,
      trackEvents: false,
    },
  });
});

// -- context getter --

it('uses current context from getter on each call', () => {
  const flagManager = makeFlagManager();
  const contextA = makeContext('user-a');
  const contextB = makeContext('user-b');
  let currentContext = contextA;

  const sink = createDataSourceUpdateSink({
    flagManager: flagManager as unknown as FlagManager,
    contextGetter: () => currentContext,
  });

  sink.handleChangeSet(makeResult(makePayload({ type: 'full', updates: [] })));
  expect(flagManager.init).toHaveBeenLastCalledWith(contextA, {});

  currentContext = contextB;
  sink.handleChangeSet(makeResult(makePayload({ type: 'full', updates: [] })));
  expect(flagManager.init).toHaveBeenLastCalledWith(contextB, {});
});

// -- logging --

it('logs debug messages for each payload type', () => {
  const flagManager = makeFlagManager();
  const logger = makeLogger();

  const sink = createDataSourceUpdateSink({
    flagManager: flagManager as unknown as FlagManager,
    contextGetter: () => makeContext(),
    logger,
  });

  sink.handleChangeSet(makeResult(makePayload({ type: 'full', updates: [] })));
  expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('full payload'));

  sink.handleChangeSet(makeResult(makePayload({ type: 'partial', updates: [] })));
  expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('partial payload'));

  sink.handleChangeSet(makeResult(makePayload({ type: 'none', updates: [] })));
  expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('none'));
});
