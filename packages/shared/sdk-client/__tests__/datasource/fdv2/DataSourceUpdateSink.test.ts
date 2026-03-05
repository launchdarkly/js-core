import { Context, internal } from '@launchdarkly/js-sdk-common';

import { createDataSourceUpdateSink } from '../../../src/datasource/fdv2/DataSourceUpdateSink';
import { ChangeSetResult } from '../../../src/datasource/fdv2/FDv2SourceResult';
import { FlagManager } from '../../../src/flag-manager/FlagManager';
import { makeLogger } from './orchestrationTestHelpers';

function makeContext(key: string = 'user-key'): Context {
  return Context.fromLDContext({ kind: 'user', key });
}

function makeFlagManager(): jest.Mocked<Pick<FlagManager, 'applyChanges'>> {
  return {
    applyChanges: jest.fn().mockResolvedValue(undefined),
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

// -- full payload delegation --

it('delegates full payload to flagManager.applyChanges with basis=true', () => {
  const flagManager = makeFlagManager();
  const context = makeContext();

  const sink = createDataSourceUpdateSink({
    flagManager: flagManager as unknown as FlagManager,
    contextGetter: () => context,
  });

  const payload = makePayload({
    type: 'full',
    state: 'sel-1',
    updates: [makeFlagEvalUpdate('flag-1', 10, true), makeFlagEvalUpdate('flag-2', 20, 'hello')],
  });

  sink.handleChangeSet(makeResult(payload, { environmentId: 'env-1' }));

  expect(flagManager.applyChanges).toHaveBeenCalledWith(
    context,
    {
      'flag-1': { version: 10, flag: { value: true, trackEvents: false, version: 10 } },
      'flag-2': { version: 20, flag: { value: 'hello', trackEvents: false, version: 20 } },
    },
    true,
    'sel-1',
    'env-1',
  );
});

// -- partial payload delegation --

it('delegates partial payload to flagManager.applyChanges with basis=false', () => {
  const flagManager = makeFlagManager();
  const context = makeContext();

  const sink = createDataSourceUpdateSink({
    flagManager: flagManager as unknown as FlagManager,
    contextGetter: () => context,
  });

  const payload = makePayload({
    type: 'partial',
    state: 'sel-2',
    updates: [makeFlagEvalUpdate('flag-a', 5, 42)],
  });

  sink.handleChangeSet(makeResult(payload));

  expect(flagManager.applyChanges).toHaveBeenCalledWith(
    context,
    { 'flag-a': { version: 5, flag: { value: 42, trackEvents: false, version: 5 } } },
    false,
    'sel-2',
    undefined,
  );
});

// -- none payload delegation --

it('delegates none payload to flagManager.applyChanges with empty updates', () => {
  const flagManager = makeFlagManager();
  const context = makeContext();

  const sink = createDataSourceUpdateSink({
    flagManager: flagManager as unknown as FlagManager,
    contextGetter: () => context,
  });

  sink.handleChangeSet(
    makeResult(makePayload({ type: 'none', state: 'sel-3', updates: [] }), {
      environmentId: 'env-2',
    }),
  );

  expect(flagManager.applyChanges).toHaveBeenCalledWith(context, {}, false, 'sel-3', 'env-2');
});

// -- selector passthrough --

it('passes undefined selector when payload state is empty string', () => {
  const flagManager = makeFlagManager();

  const sink = createDataSourceUpdateSink({
    flagManager: flagManager as unknown as FlagManager,
    contextGetter: () => makeContext(),
  });

  sink.handleChangeSet(makeResult(makePayload({ state: '' })));

  expect(flagManager.applyChanges).toHaveBeenCalledWith(
    expect.anything(),
    expect.anything(),
    true,
    undefined,
    undefined,
  );
});

it('passes undefined selector when payload state is undefined', () => {
  const flagManager = makeFlagManager();

  const sink = createDataSourceUpdateSink({
    flagManager: flagManager as unknown as FlagManager,
    contextGetter: () => makeContext(),
  });

  sink.handleChangeSet(makeResult(makePayload({ state: undefined })));

  expect(flagManager.applyChanges).toHaveBeenCalledWith(
    expect.anything(),
    expect.anything(),
    true,
    undefined,
    undefined,
  );
});

// -- non-flagEval kinds --

it('ignores non-flagEval update kinds in conversion', () => {
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

  expect(flagManager.applyChanges).toHaveBeenCalledWith(
    expect.anything(),
    {},
    true,
    expect.anything(),
    undefined,
  );
});

// -- delete handling --

it('converts delete updates to tombstone descriptors', () => {
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

  expect(flagManager.applyChanges).toHaveBeenCalledWith(
    context,
    {
      'deleted-flag': {
        version: 7,
        flag: { version: 7, deleted: true, value: undefined, trackEvents: false },
      },
    },
    true,
    expect.anything(),
    undefined,
  );
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
  expect(flagManager.applyChanges).toHaveBeenLastCalledWith(
    contextA,
    {},
    true,
    expect.anything(),
    undefined,
  );

  currentContext = contextB;
  sink.handleChangeSet(makeResult(makePayload({ type: 'full', updates: [] })));
  expect(flagManager.applyChanges).toHaveBeenLastCalledWith(
    contextB,
    {},
    true,
    expect.anything(),
    undefined,
  );
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
  expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('full'));

  sink.handleChangeSet(makeResult(makePayload({ type: 'partial', updates: [] })));
  expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('partial'));

  sink.handleChangeSet(makeResult(makePayload({ type: 'none', updates: [] })));
  expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('none'));
});
