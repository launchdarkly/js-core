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
  flag: (it: any) => it,
  segment: (it: any) => it,
};

function createHandler(logger?: LDLogger): ProtocolHandler {
  return createProtocolHandler(passthrough, logger);
}

describe('createProtocolHandler', () => {
  describe('initial state', () => {
    it('starts in inactive state', () => {
      const handler = createHandler();
      expect(handler.state).toBe('inactive');
    });
  });

  describe('server-intent with xfer-full', () => {
    it('transitions to full state and returns none', () => {
      const handler = createHandler();
      const action = handler.processEvent(intentEvent('xfer-full'));
      expect(action.type).toBe('none');
      expect(handler.state).toBe('full');
    });

    it('emits full payload on payload-transferred', () => {
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
  });

  describe('server-intent with xfer-changes', () => {
    it('transitions to changes state and returns none', () => {
      const handler = createHandler();
      const action = handler.processEvent(intentEvent('xfer-changes'));
      expect(action.type).toBe('none');
      expect(handler.state).toBe('changes');
    });

    it('emits partial payload on payload-transferred', () => {
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
      expect(action.payload.updates[1]).toMatchObject({
        kind: 'flag',
        key: 'f-bat',
        deleted: true,
      });
      expect(action.payload.updates[2]).toMatchObject({
        kind: 'flag',
        key: 'f-cow',
        object: { on: false },
      });
    });
  });

  describe('server-intent with none', () => {
    it('returns a none-type payload immediately', () => {
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

    it('transitions to changes state for subsequent updates', () => {
      const handler = createHandler();
      handler.processEvent(intentEvent('none', 'p1', 1));

      handler.processEvent(putEvent('flag', 'f1', 2, { on: true }));
      const action = handler.processEvent(transferredEvent('(p:p1:2)', 2));

      expect(action.type).toBe('payload');
      if (action.type !== 'payload') return;
      expect(action.payload.type).toBe('partial');
    });
  });

  describe('server-intent edge cases', () => {
    it('returns error when payloads list is empty', () => {
      const handler = createHandler();
      const action = handler.processEvent({
        event: 'server-intent',
        data: { payloads: [] },
      });
      expect(action.type).toBe('error');
      if (action.type !== 'error') return;
      expect(action.kind).toBe('MISSING_PAYLOAD');
    });

    it('uses only the first payload when multiple are present', () => {
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

    it('warns and returns none for unrecognized intent code', () => {
      const logger: LDLogger = {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
      };
      const handler = createProtocolHandler(passthrough, logger);
      const action = handler.processEvent(intentEvent('unknown-code'));
      expect(action.type).toBe('none');
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('put-object', () => {
    it('accumulates objects during a transfer', () => {
      const handler = createHandler();
      handler.processEvent(intentEvent('xfer-full'));
      handler.processEvent(putEvent('flag', 'f1', 1, { key: 'f1', on: true, version: 314 }));

      const action = handler.processEvent(transferredEvent('s', 1));
      if (action.type !== 'payload') return;

      expect(action.payload.updates).toHaveLength(1);
      expect(action.payload.updates[0].object).toEqual({ key: 'f1', on: true, version: 314 });
      expect(action.payload.updates[0].deleted).toBeUndefined();
    });

    it('is ignored before server-intent (inactive state)', () => {
      const handler = createHandler();
      const action = handler.processEvent(putEvent('flag', 'f1', 1, { on: true }));
      expect(action.type).toBe('none');
    });

    it('silently ignores unrecognized kinds', () => {
      const handler = createHandler();
      handler.processEvent(intentEvent('xfer-full'));
      handler.processEvent(putEvent('unknownKind', 'f1', 1, { on: true }));

      const action = handler.processEvent(transferredEvent('s', 1));
      if (action.type !== 'payload') return;
      expect(action.payload.updates).toHaveLength(0);
    });
  });

  describe('delete-object', () => {
    it('accumulates deletes during a transfer', () => {
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

    it('is ignored before server-intent (inactive state)', () => {
      const handler = createHandler();
      const action = handler.processEvent(deleteEvent('flag', 'f1', 1));
      expect(action.type).toBe('none');
    });
  });

  describe('payload-transferred', () => {
    it('returns protocol error when received in inactive state', () => {
      const handler = createHandler();
      const action = handler.processEvent(transferredEvent('s', 1));
      expect(action.type).toBe('error');
      if (action.type !== 'error') return;
      expect(action.kind).toBe('PROTOCOL_ERROR');
      expect(action.message).toContain('without an intent');
    });

    it('transitions to changes state after emission', () => {
      const handler = createHandler();
      handler.processEvent(intentEvent('xfer-full'));
      handler.processEvent(putEvent('flag', 'f1', 1, { on: true }));
      handler.processEvent(transferredEvent('s1', 1));

      expect(handler.state).toBe('changes');

      // Subsequent transfer should be partial
      handler.processEvent(putEvent('flag', 'f2', 2, { on: false }));
      const action = handler.processEvent(transferredEvent('s2', 2));
      if (action.type !== 'payload') return;
      expect(action.payload.type).toBe('partial');
    });

    it('emits empty changeset for transfer with no objects', () => {
      const handler = createHandler();
      handler.processEvent(intentEvent('xfer-full'));
      const action = handler.processEvent(transferredEvent('s', 1));
      if (action.type !== 'payload') return;
      expect(action.payload.type).toBe('full');
      expect(action.payload.updates).toHaveLength(0);
    });

    it('resets all state when state field is missing', () => {
      const handler = createHandler();
      handler.processEvent(intentEvent('xfer-full'));
      handler.processEvent(putEvent('flag', 'f1', 1, { on: true }));
      const action = handler.processEvent({
        event: 'payload-transferred',
        data: { version: 1 }, // missing state
      });
      expect(action.type).toBe('none');
      expect(handler.state).toBe('inactive');
    });
  });

  describe('error handling', () => {
    it('discards partially transferred data', () => {
      const handler = createHandler();
      handler.processEvent(intentEvent('xfer-full'));
      handler.processEvent(putEvent('flag', 'f1', 1, { on: true }));
      handler.processEvent(putEvent('flag', 'f2', 1, { on: false }));

      const errorAction = handler.processEvent(errorEvent('Something went wrong', 'p1'));
      expect(errorAction.type).toBe('serverError');

      // Recovery: server sends new transfer
      handler.processEvent(intentEvent('xfer-full'));
      handler.processEvent(putEvent('flag', 'f3', 1, { on: true }));
      const action = handler.processEvent(transferredEvent('s', 1));
      if (action.type !== 'payload') return;

      expect(action.payload.updates).toHaveLength(1);
      expect(action.payload.updates[0].key).toBe('f3');
    });

    it('maintains current state (full/changes) after error', () => {
      const handler = createHandler();
      handler.processEvent(intentEvent('xfer-changes'));
      handler.processEvent(putEvent('flag', 'f1', 1, { on: true }));
      handler.processEvent(errorEvent('error'));

      expect(handler.state).toBe('changes');

      // Continue receiving changes without new server-intent
      handler.processEvent(putEvent('flag', 'f2', 1, { on: false }));
      const action = handler.processEvent(transferredEvent('s', 1));
      if (action.type !== 'payload') return;

      expect(action.payload.type).toBe('partial');
      expect(action.payload.updates).toHaveLength(1);
      expect(action.payload.updates[0].key).toBe('f2');
    });
  });

  describe('goodbye', () => {
    it('returns goodbye action with reason', () => {
      const logger: LDLogger = {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
      };
      const handler = createProtocolHandler(passthrough, logger);
      const action = handler.processEvent(goodbyeEvent('Server is shutting down'));

      expect(action.type).toBe('goodbye');
      if (action.type !== 'goodbye') return;
      expect(action.reason).toBe('Server is shutting down');
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Server is shutting down'));
    });
  });

  describe('heartbeat', () => {
    it('is silently ignored', () => {
      const handler = createHandler();
      const action = handler.processEvent(heartbeatEvent());
      expect(action.type).toBe('none');
    });
  });

  describe('unknown events', () => {
    it('returns unknown event error', () => {
      const handler = createHandler();
      const action = handler.processEvent({ event: 'totally-unknown', data: {} });
      expect(action.type).toBe('error');
      if (action.type !== 'error') return;
      expect(action.kind).toBe('UNKNOWN_EVENT');
      expect(action.message).toContain('totally-unknown');
    });
  });

  describe('multiple transfer cycles', () => {
    it('handles full then incremental transfers', () => {
      const handler = createHandler();

      // Full transfer
      handler.processEvent(intentEvent('xfer-full', 'p1', 52));
      handler.processEvent(putEvent('flag', 'f1', 1, { on: true }));
      handler.processEvent(putEvent('flag', 'f2', 1, { on: false }));
      const action1 = handler.processEvent(transferredEvent('(p:p1:52)', 52));
      if (action1.type !== 'payload') return;
      expect(action1.payload.type).toBe('full');
      expect(action1.payload.updates).toHaveLength(2);

      // Incremental transfer (no new server-intent needed)
      handler.processEvent(putEvent('flag', 'f1', 2, { on: false }));
      handler.processEvent(deleteEvent('flag', 'f2', 2));
      const action2 = handler.processEvent(transferredEvent('(p:p1:53)', 53));
      if (action2.type !== 'payload') return;
      expect(action2.payload.type).toBe('partial');
      expect(action2.payload.updates).toHaveLength(2);

      // Another incremental
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

      // New server-intent before payload-transferred
      handler.processEvent(intentEvent('xfer-full', 'p1', 2));
      handler.processEvent(putEvent('flag', 'f2', 2, { on: false }));
      const action = handler.processEvent(transferredEvent('(p:p1:2)', 2));
      if (action.type !== 'payload') return;

      expect(action.payload.updates).toHaveLength(1);
      expect(action.payload.updates[0].key).toBe('f2');
    });
  });

  describe('reset', () => {
    it('clears accumulated changes and returns to inactive', () => {
      const handler = createHandler();
      handler.processEvent(intentEvent('xfer-full'));
      handler.processEvent(putEvent('flag', 'f1', 1, { on: true }));
      handler.processEvent(putEvent('flag', 'f2', 1, { on: false }));

      handler.reset();
      expect(handler.state).toBe('inactive');

      // payload-transferred should return protocol error (inactive state)
      const action = handler.processEvent(transferredEvent('s', 1));
      expect(action.type).toBe('error');
      if (action.type !== 'error') return;
      expect(action.kind).toBe('PROTOCOL_ERROR');
    });

    it('allows starting a new transfer cycle', () => {
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

    it('clears state after completed transfer', () => {
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

    it('clears state after error', () => {
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
  });

  describe('selector population', () => {
    it('populates state from payload-transferred', () => {
      const handler = createHandler();
      handler.processEvent(intentEvent('xfer-full', 'test-id', 42));
      handler.processEvent(putEvent('flag', 'f1', 1, { on: true }));
      const action = handler.processEvent(transferredEvent('(p:test-id:42)', 42));
      if (action.type !== 'payload') return;

      expect(action.payload.state).toBe('(p:test-id:42)');
      expect(action.payload.version).toBe(42);
    });

    it('has no state for intent none', () => {
      const handler = createHandler();
      const action = handler.processEvent(intentEvent('none', 'p1', 1));
      if (action.type !== 'payload') return;
      expect(action.payload.state).toBeUndefined();
    });

    it('accepts empty string as a valid state', () => {
      const handler = createHandler();
      handler.processEvent(intentEvent('xfer-full'));
      handler.processEvent(putEvent('flag', 'f1', 1, { on: true }));
      const action = handler.processEvent(transferredEvent('', 1));
      if (action.type !== 'payload') return;
      expect(action.payload.state).toBe('');
    });
  });
});
