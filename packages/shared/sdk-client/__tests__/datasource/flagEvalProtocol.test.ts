import { internal } from '@launchdarkly/js-sdk-common';

import { processFlagEval } from '../../src/datasource/flagEvalMapper';

function intentEvent(intentCode: string, id = 'test-payload', target = 1): internal.FDv2Event {
  return {
    event: 'server-intent',
    data: { payloads: [{ intentCode, id, target, reason: 'test' }] },
  };
}

function putEvent(
  kind: string,
  key: string,
  version: number,
  object: any = {},
): internal.FDv2Event {
  return { event: 'put-object', data: { kind, key, version, object } };
}

function deleteEvent(kind: string, key: string, version: number): internal.FDv2Event {
  return { event: 'delete-object', data: { kind, key, version } };
}

function transferredEvent(state: string, version: number): internal.FDv2Event {
  return { event: 'payload-transferred', data: { state, version } };
}

function createHandler() {
  return internal.createProtocolHandler({ flagEval: processFlagEval });
}

it('processes flagEval put-object events through the protocol handler', () => {
  const handler = createHandler();
  handler.processEvent(intentEvent('xfer-full', 'p1', 1));
  handler.processEvent(
    putEvent('flagEval', 'my-flag', 5, {
      flagVersion: 42,
      value: 'green',
      variation: 1,
      trackEvents: true,
    }),
  );

  const action = handler.processEvent(transferredEvent('(p:p1:1)', 1));
  expect(action.type).toBe('payload');
  if (action.type !== 'payload') return;

  expect(action.payload.updates).toHaveLength(1);
  expect(action.payload.updates[0].kind).toBe('flagEval');
  expect(action.payload.updates[0].key).toBe('my-flag');
  expect(action.payload.updates[0].version).toBe(5);
  expect(action.payload.updates[0].object.value).toBe('green');
});

it('processes flagEval delete-object events through the protocol handler', () => {
  const handler = createHandler();
  handler.processEvent(intentEvent('xfer-changes', 'p1', 1));
  handler.processEvent(deleteEvent('flagEval', 'old-flag', 10));

  const action = handler.processEvent(transferredEvent('(p:p1:1)', 1));
  expect(action.type).toBe('payload');
  if (action.type !== 'payload') return;

  expect(action.payload.updates).toHaveLength(1);
  expect(action.payload.updates[0].kind).toBe('flagEval');
  expect(action.payload.updates[0].key).toBe('old-flag');
  expect(action.payload.updates[0].version).toBe(10);
  expect(action.payload.updates[0].deleted).toBe(true);
});

it('silently ignores unrecognized object kinds when flagEval is the only processor', () => {
  const handler = createHandler();
  handler.processEvent(intentEvent('xfer-full', 'p1', 1));
  handler.processEvent(putEvent('flagEval', 'known', 1, { value: true, trackEvents: false }));
  handler.processEvent(putEvent('unknown_kind', 'mystery', 1, { data: 'ignored' }));

  const action = handler.processEvent(transferredEvent('(p:p1:1)', 1));
  expect(action.type).toBe('payload');
  if (action.type !== 'payload') return;

  expect(action.payload.updates).toHaveLength(1);
  expect(action.payload.updates[0].key).toBe('known');
});

it('handles a full transfer of multiple flagEval objects', () => {
  const handler = createHandler();
  handler.processEvent(intentEvent('xfer-full', 'p1', 52));
  handler.processEvent(putEvent('flagEval', 'flag-a', 1, { value: true, trackEvents: false }));
  handler.processEvent(
    putEvent('flagEval', 'flag-b', 2, { value: 'blue', trackEvents: true, variation: 1 }),
  );
  handler.processEvent(putEvent('flagEval', 'flag-c', 3, { value: 42, trackEvents: false }));

  const action = handler.processEvent(transferredEvent('(p:p1:52)', 52));
  expect(action.type).toBe('payload');
  if (action.type !== 'payload') return;

  expect(action.payload.type).toBe('full');
  expect(action.payload.updates).toHaveLength(3);
  expect(action.payload.updates.map((u) => u.key)).toEqual(['flag-a', 'flag-b', 'flag-c']);
});

it('handles incremental updates with flagEval after a full transfer', () => {
  const handler = createHandler();

  // Full transfer
  handler.processEvent(intentEvent('xfer-full', 'p1', 1));
  handler.processEvent(putEvent('flagEval', 'flag-a', 1, { value: true, trackEvents: false }));
  handler.processEvent(transferredEvent('(p:p1:1)', 1));

  // Incremental update
  handler.processEvent(putEvent('flagEval', 'flag-a', 2, { value: false, trackEvents: true }));
  handler.processEvent(deleteEvent('flagEval', 'flag-b', 3));

  const action = handler.processEvent(transferredEvent('(p:p1:2)', 2));
  expect(action.type).toBe('payload');
  if (action.type !== 'payload') return;

  expect(action.payload.type).toBe('partial');
  expect(action.payload.updates).toHaveLength(2);
  expect(action.payload.updates[0]).toMatchObject({
    kind: 'flagEval',
    key: 'flag-a',
    object: { value: false },
  });
  expect(action.payload.updates[1]).toMatchObject({
    kind: 'flagEval',
    key: 'flag-b',
    deleted: true,
  });
});
