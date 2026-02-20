import { LDLogger } from '../../../src/api';
import { createProtocolHandler, FDv2Event } from '../../../src/internal/fdv2/protocolHandler';

function intentEvent(intentCode: string, id = 'test-payload', target = 1): FDv2Event {
  return {
    event: 'server-intent',
    data: { payloads: [{ intentCode, id, target, reason: 'test' }] },
  };
}

function putEvent(kind: string, key: string, version: number, object: any = {}): FDv2Event {
  return { event: 'put-object', data: { kind, key, version, object } };
}

function deleteEvent(kind: string, key: string, version: number): FDv2Event {
  return { event: 'delete-object', data: { kind, key, version } };
}

function transferredEvent(state: string, version: number): FDv2Event {
  return { event: 'payload-transferred', data: { state, version } };
}

function errorEvent(reason: string, payloadId?: string): FDv2Event {
  return { event: 'error', data: { reason, payload_id: payloadId } };
}

function goodbyeEvent(reason: string): FDv2Event {
  return { event: 'goodbye', data: { reason } };
}

function heartbeatEvent(): FDv2Event {
  return { event: 'heart-beat', data: {} };
}

const passthrough: Record<string, (o: any) => any> = {
  flag: (obj: any) => obj,
  segment: (obj: any) => obj,
};

function createHandler(logger?: LDLogger) {
  return createProtocolHandler(passthrough, logger);
}

it('starts in inactive state', () => {
  const handler = createHandler();
  expect(handler.state).toBe('inactive');
});

it('transitions to full state on xfer-full server-intent', () => {
  const handler = createHandler();
  const action = handler.processEvent(intentEvent('xfer-full'));
  expect(action.type).toBe('none');
  expect(handler.state).toBe('full');
});

it('emits a full payload after xfer-full and payload-transferred', () => {
  const handler = createHandler();
  handler.processEvent(intentEvent('xfer-full', 'p1', 52));
  handler.processEvent(putEvent('flag', 'f1', 1, { on: true }));
  handler.processEvent(putEvent('flag', 'f2', 2, { on: false }));

  const action = handler.processEvent(transferredEvent('(p:p1:52)', 52));
  expect(action.type).toBe('payload');
  if (action.type !== 'payload') return;

  expect(action.payload.type).toBe('full');
  expect(action.payload.id).toBe('p1');
  expect(action.payload.version).toBe(52);
  expect(action.payload.state).toBe('(p:p1:52)');
  expect(action.payload.updates).toHaveLength(2);
  expect(action.payload.updates[0].key).toBe('f1');
  expect(action.payload.updates[1].key).toBe('f2');
});

it('transitions to changes state on xfer-changes server-intent', () => {
  const handler = createHandler();
  const action = handler.processEvent(intentEvent('xfer-changes'));
  expect(action.type).toBe('none');
  expect(handler.state).toBe('changes');
});

it('emits a partial payload after xfer-changes and payload-transferred', () => {
  const handler = createHandler();
  handler.processEvent(intentEvent('xfer-changes', 'p1', 52));
  handler.processEvent(putEvent('flag', 'f-cat', 13, { on: true }));
  handler.processEvent(deleteEvent('flag', 'f-bat', 13));
  handler.processEvent(putEvent('flag', 'f-cow', 14, { on: false }));

  const action = handler.processEvent(transferredEvent('(p:p1:52)', 52));
  expect(action.type).toBe('payload');
  if (action.type !== 'payload') return;

  expect(action.payload.type).toBe('partial');
  expect(action.payload.updates).toHaveLength(3);
  expect(action.payload.updates[0]).toMatchObject({
    kind: 'flag',
    key: 'f-cat',
    object: { on: true },
  });
  expect(action.payload.updates[1]).toMatchObject({ kind: 'flag', key: 'f-bat', deleted: true });
  expect(action.payload.updates[2]).toMatchObject({
    kind: 'flag',
    key: 'f-cow',
    object: { on: false },
  });
});

it('returns a none-type payload immediately on intent-none', () => {
  const handler = createHandler();
  const action = handler.processEvent(intentEvent('none', 'p1', 42));

  expect(action.type).toBe('payload');
  if (action.type !== 'payload') return;

  expect(action.payload.type).toBe('none');
  expect(action.payload.id).toBe('p1');
  expect(action.payload.version).toBe(42);
  expect(action.payload.updates).toHaveLength(0);
  expect(action.payload.state).toBeUndefined();
});

it('transitions to changes state after intent-none for subsequent updates', () => {
  const handler = createHandler();
  handler.processEvent(intentEvent('none', 'p1', 1));

  handler.processEvent(putEvent('flag', 'f1', 2, { on: true }));
  const action = handler.processEvent(transferredEvent('(p:p1:2)', 2));

  expect(action.type).toBe('payload');
  if (action.type !== 'payload') return;
  expect(action.payload.type).toBe('partial');
});

it('returns a missing-payload error when server-intent has an empty payloads list', () => {
  const handler = createHandler();
  const action = handler.processEvent({
    event: 'server-intent',
    data: { payloads: [] },
  });
  expect(action.type).toBe('error');
  if (action.type !== 'error') return;
  expect(action.kind).toBe('MISSING_PAYLOAD');
});

it('uses only the first payload when server-intent contains multiple', () => {
  const handler = createHandler();
  const action = handler.processEvent({
    event: 'server-intent',
    data: {
      payloads: [
        { intentCode: 'xfer-changes', id: 'p1', target: 10, reason: 'stale' },
        { intentCode: 'none', id: 'p2', target: 20, reason: 'up-to-date' },
      ],
    },
  });
  expect(action.type).toBe('none');
  expect(handler.state).toBe('changes');
});

it('warns and returns none for an unrecognized intent code', () => {
  const logger: LDLogger = { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() };
  const handler = createProtocolHandler(passthrough, logger);
  const action = handler.processEvent(intentEvent('unknown-code'));
  expect(action.type).toBe('none');
  expect(logger.warn).toHaveBeenCalled();
});

it('accumulates put-objects during a transfer', () => {
  const handler = createHandler();
  handler.processEvent(intentEvent('xfer-full'));
  handler.processEvent(putEvent('flag', 'f1', 1, { key: 'f1', on: true, version: 314 }));

  const action = handler.processEvent(transferredEvent('s', 1));
  if (action.type !== 'payload') return;

  expect(action.payload.updates).toHaveLength(1);
  expect(action.payload.updates[0].object).toEqual({ key: 'f1', on: true, version: 314 });
  expect(action.payload.updates[0].deleted).toBeUndefined();
});

it('ignores put-objects received before a server-intent', () => {
  const handler = createHandler();
  const action = handler.processEvent(putEvent('flag', 'f1', 1, { on: true }));
  expect(action.type).toBe('none');
});

it('silently ignores put-objects with unrecognized kinds', () => {
  const handler = createHandler();
  handler.processEvent(intentEvent('xfer-full'));
  handler.processEvent(putEvent('unknownKind', 'f1', 1, { on: true }));

  const action = handler.processEvent(transferredEvent('s', 1));
  if (action.type !== 'payload') return;
  expect(action.payload.updates).toHaveLength(0);
});

it('accumulates delete-objects during a transfer', () => {
  const handler = createHandler();
  handler.processEvent(intentEvent('xfer-changes'));
  handler.processEvent(deleteEvent('segment', 'old-segment', 99));

  const action = handler.processEvent(transferredEvent('s', 1));
  if (action.type !== 'payload') return;

  expect(action.payload.updates).toHaveLength(1);
  expect(action.payload.updates[0]).toMatchObject({
    kind: 'segment',
    key: 'old-segment',
    version: 99,
    deleted: true,
  });
  expect(action.payload.updates[0].object).toBeUndefined();
});

it('ignores delete-objects received before a server-intent', () => {
  const handler = createHandler();
  const action = handler.processEvent(deleteEvent('flag', 'f1', 1));
  expect(action.type).toBe('none');
});

it('returns a protocol error when payload-transferred is received in inactive state', () => {
  const handler = createHandler();
  const action = handler.processEvent(transferredEvent('s', 1));
  expect(action.type).toBe('error');
  if (action.type !== 'error') return;
  expect(action.kind).toBe('PROTOCOL_ERROR');
  expect(action.message).toContain('without an intent');
});

it('transitions to changes state after payload-transferred emission', () => {
  const handler = createHandler();
  handler.processEvent(intentEvent('xfer-full'));
  handler.processEvent(putEvent('flag', 'f1', 1, { on: true }));
  handler.processEvent(transferredEvent('s1', 1));

  expect(handler.state).toBe('changes');

  handler.processEvent(putEvent('flag', 'f2', 2, { on: false }));
  const action = handler.processEvent(transferredEvent('s2', 2));
  if (action.type !== 'payload') return;
  expect(action.payload.type).toBe('partial');
});

it('emits an empty full changeset for a transfer with no objects', () => {
  const handler = createHandler();
  handler.processEvent(intentEvent('xfer-full'));
  const action = handler.processEvent(transferredEvent('s', 1));
  if (action.type !== 'payload') return;
  expect(action.payload.type).toBe('full');
  expect(action.payload.updates).toHaveLength(0);
});

it('resets to inactive when payload-transferred has a missing state field', () => {
  const handler = createHandler();
  handler.processEvent(intentEvent('xfer-full'));
  handler.processEvent(putEvent('flag', 'f1', 1, { on: true }));
  const action = handler.processEvent({
    event: 'payload-transferred',
    data: { version: 1 },
  });
  expect(action.type).toBe('none');
  expect(handler.state).toBe('inactive');
});

it('discards partially transferred data when a server error is received', () => {
  const handler = createHandler();
  handler.processEvent(intentEvent('xfer-full'));
  handler.processEvent(putEvent('flag', 'f1', 1, { on: true }));
  handler.processEvent(putEvent('flag', 'f2', 1, { on: false }));

  const errorAction = handler.processEvent(errorEvent('Something went wrong', 'p1'));
  expect(errorAction.type).toBe('serverError');

  handler.processEvent(intentEvent('xfer-full'));
  handler.processEvent(putEvent('flag', 'f3', 1, { on: true }));
  const action = handler.processEvent(transferredEvent('s', 1));
  if (action.type !== 'payload') return;

  expect(action.payload.updates).toHaveLength(1);
  expect(action.payload.updates[0].key).toBe('f3');
});

it('maintains current protocol state after a server error', () => {
  const handler = createHandler();
  handler.processEvent(intentEvent('xfer-changes'));
  handler.processEvent(putEvent('flag', 'f1', 1, { on: true }));
  handler.processEvent(errorEvent('error'));

  expect(handler.state).toBe('changes');

  handler.processEvent(putEvent('flag', 'f2', 1, { on: false }));
  const action = handler.processEvent(transferredEvent('s', 1));
  if (action.type !== 'payload') return;

  expect(action.payload.type).toBe('partial');
  expect(action.payload.updates).toHaveLength(1);
  expect(action.payload.updates[0].key).toBe('f2');
});

it('returns a goodbye action with reason and logs it', () => {
  const logger: LDLogger = { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() };
  const handler = createProtocolHandler(passthrough, logger);
  const action = handler.processEvent(goodbyeEvent('Server is shutting down'));

  expect(action.type).toBe('goodbye');
  if (action.type !== 'goodbye') return;
  expect(action.reason).toBe('Server is shutting down');
  expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Server is shutting down'));
});

it('silently ignores heartbeat events', () => {
  const handler = createHandler();
  const action = handler.processEvent(heartbeatEvent());
  expect(action.type).toBe('none');
});

it('returns an unknown-event error for unrecognized event types', () => {
  const handler = createHandler();
  const action = handler.processEvent({ event: 'totally-unknown', data: {} });
  expect(action.type).toBe('error');
  if (action.type !== 'error') return;
  expect(action.kind).toBe('UNKNOWN_EVENT');
  expect(action.message).toContain('totally-unknown');
});

it('handles full then incremental transfer cycles', () => {
  const handler = createHandler();

  handler.processEvent(intentEvent('xfer-full', 'p1', 52));
  handler.processEvent(putEvent('flag', 'f1', 1, { on: true }));
  handler.processEvent(putEvent('flag', 'f2', 1, { on: false }));
  const action1 = handler.processEvent(transferredEvent('(p:p1:52)', 52));
  if (action1.type !== 'payload') return;
  expect(action1.payload.type).toBe('full');
  expect(action1.payload.updates).toHaveLength(2);

  handler.processEvent(putEvent('flag', 'f1', 2, { on: false }));
  handler.processEvent(deleteEvent('flag', 'f2', 2));
  const action2 = handler.processEvent(transferredEvent('(p:p1:53)', 53));
  if (action2.type !== 'payload') return;
  expect(action2.payload.type).toBe('partial');
  expect(action2.payload.updates).toHaveLength(2);

  handler.processEvent(putEvent('flag', 'f3', 3, { on: true }));
  const action3 = handler.processEvent(transferredEvent('(p:p1:54)', 54));
  if (action3.type !== 'payload') return;
  expect(action3.payload.type).toBe('partial');
  expect(action3.payload.updates).toHaveLength(1);
});

it('resets accumulated changes when a new server-intent arrives mid-transfer', () => {
  const handler = createHandler();
  handler.processEvent(intentEvent('xfer-full', 'p1', 1));
  handler.processEvent(putEvent('flag', 'f1', 1, { on: true }));

  handler.processEvent(intentEvent('xfer-full', 'p1', 2));
  handler.processEvent(putEvent('flag', 'f2', 2, { on: false }));
  const action = handler.processEvent(transferredEvent('(p:p1:2)', 2));
  if (action.type !== 'payload') return;

  expect(action.payload.updates).toHaveLength(1);
  expect(action.payload.updates[0].key).toBe('f2');
});

it('clears accumulated changes and returns to inactive on reset', () => {
  const handler = createHandler();
  handler.processEvent(intentEvent('xfer-full'));
  handler.processEvent(putEvent('flag', 'f1', 1, { on: true }));
  handler.processEvent(putEvent('flag', 'f2', 1, { on: false }));

  handler.reset();
  expect(handler.state).toBe('inactive');

  const action = handler.processEvent(transferredEvent('s', 1));
  expect(action.type).toBe('error');
  if (action.type !== 'error') return;
  expect(action.kind).toBe('PROTOCOL_ERROR');
});

it('allows starting a new transfer cycle after reset', () => {
  const handler = createHandler();
  handler.processEvent(intentEvent('xfer-full', 'p1', 1));
  handler.processEvent(putEvent('flag', 'f1', 1, { on: true }));

  handler.reset();

  handler.processEvent(intentEvent('xfer-full', 'p2', 2));
  handler.processEvent(putEvent('flag', 'f2', 2, { on: false }));
  const action = handler.processEvent(transferredEvent('(p:p2:2)', 2));
  if (action.type !== 'payload') return;

  expect(action.payload.type).toBe('full');
  expect(action.payload.updates).toHaveLength(1);
  expect(action.payload.updates[0].key).toBe('f2');
});

it('can be called multiple times safely', () => {
  const handler = createHandler();
  handler.reset();
  handler.processEvent(intentEvent('xfer-full'));
  handler.reset();
  handler.reset();

  const action = handler.processEvent(intentEvent('none', 'p1', 1));
  expect(action.type).toBe('payload');
});

it('clears state after a completed transfer on reset', () => {
  const handler = createHandler();
  handler.processEvent(intentEvent('xfer-full', 'p1', 1));
  handler.processEvent(putEvent('flag', 'f1', 1, { on: true }));
  handler.processEvent(transferredEvent('s', 1));

  handler.reset();
  expect(handler.state).toBe('inactive');

  handler.processEvent(intentEvent('xfer-full', 'p2', 2));
  handler.processEvent(putEvent('flag', 'f2', 2, { on: false }));
  const action = handler.processEvent(transferredEvent('(p:p2:2)', 2));
  if (action.type !== 'payload') return;

  expect(action.payload.updates).toHaveLength(1);
  expect(action.payload.updates[0].key).toBe('f2');
});

it('clears state after an error on reset', () => {
  const handler = createHandler();
  handler.processEvent(intentEvent('xfer-full'));
  handler.processEvent(putEvent('flag', 'f1', 1, { on: true }));
  handler.processEvent(errorEvent('Something went wrong'));

  handler.reset();
  expect(handler.state).toBe('inactive');

  const action = handler.processEvent(transferredEvent('s', 1));
  expect(action.type).toBe('error');
  if (action.type !== 'error') return;
  expect(action.kind).toBe('PROTOCOL_ERROR');
});

it('populates state and version from payload-transferred', () => {
  const handler = createHandler();
  handler.processEvent(intentEvent('xfer-full', 'test-id', 42));
  handler.processEvent(putEvent('flag', 'f1', 1, { on: true }));
  const action = handler.processEvent(transferredEvent('(p:test-id:42)', 42));
  if (action.type !== 'payload') return;

  expect(action.payload.state).toBe('(p:test-id:42)');
  expect(action.payload.version).toBe(42);
});

it('does not include state in a none-type payload', () => {
  const handler = createHandler();
  const action = handler.processEvent(intentEvent('none', 'p1', 1));
  if (action.type !== 'payload') return;
  expect(action.payload.state).toBeUndefined();
});

it('accepts an empty string as a valid state in payload-transferred', () => {
  const handler = createHandler();
  handler.processEvent(intentEvent('xfer-full'));
  handler.processEvent(putEvent('flag', 'f1', 1, { on: true }));
  const action = handler.processEvent(transferredEvent('', 1));
  if (action.type !== 'payload') return;
  expect(action.payload.state).toBe('');
});
