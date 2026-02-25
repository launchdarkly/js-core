import { DataSourceErrorKind } from '@launchdarkly/js-sdk-common';

import { FDv2PollResponse, FDv2Requestor } from '../../../src/datasource/fdv2/FDv2Requestor';
import { poll } from '../../../src/datasource/fdv2/PollingBase';

function makeHeaders(extra: Record<string, string> = {}): { get(name: string): string | null } {
  const headers: Record<string, string> = { ...extra };
  return {
    get(name: string): string | null {
      return headers[name.toLowerCase()] ?? null;
    },
  };
}

function makeRequestor(response: FDv2PollResponse): FDv2Requestor {
  return {
    poll: jest.fn().mockResolvedValue(response),
  };
}

function makeErrorRequestor(error: Error): FDv2Requestor {
  return {
    poll: jest.fn().mockRejectedValue(error),
  };
}

function makeFDv2Body(events: any[]): string {
  return JSON.stringify({ events });
}

function makeFullPayloadBody(flags: Record<string, { value: any; trackEvents?: boolean }>): string {
  const events: any[] = [
    {
      event: 'server-intent',
      data: {
        payloads: [{ id: 'test-payload', target: 1, intentCode: 'xfer-full', reason: 'test' }],
      },
    },
  ];

  Object.entries(flags).forEach(([key, flag]) => {
    events.push({
      event: 'put-object',
      data: {
        kind: 'flagEval',
        key,
        version: 1,
        object: { value: flag.value, trackEvents: flag.trackEvents ?? false },
      },
    });
  });

  events.push({
    event: 'payload-transferred',
    data: { state: 'test-state', version: 1, id: 'test-payload' },
  });

  return makeFDv2Body(events);
}

const logger = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('given a successful FDv2 response', () => {
  it('returns a changeSet result with parsed flag data', async () => {
    const body = makeFullPayloadBody({ flagA: { value: true, trackEvents: false } });
    const requestor = makeRequestor({
      status: 200,
      headers: makeHeaders(),
      body,
    });

    const result = await poll(requestor, undefined, false, logger);

    expect(result.type).toBe('changeSet');
    if (result.type === 'changeSet') {
      expect(result.payload.type).toBe('full');
      expect(result.payload.updates).toHaveLength(1);
      expect(result.payload.updates[0].key).toBe('flagA');
      expect(result.payload.updates[0].object).toEqual({
        value: true,
        trackEvents: false,
      });
      expect(result.payload.state).toBe('test-state');
    }
  });

  it('includes the basis parameter when provided', async () => {
    const body = makeFullPayloadBody({ flagA: { value: true } });
    const requestor = makeRequestor({
      status: 200,
      headers: makeHeaders(),
      body,
    });

    await poll(requestor, 'my-basis', false, logger);

    expect(requestor.poll).toHaveBeenCalledWith('my-basis');
  });
});

describe('given a 304 Not Modified response', () => {
  it('returns a changeSet with type none', async () => {
    const requestor = makeRequestor({
      status: 304,
      headers: makeHeaders(),
      body: null,
    });

    const result = await poll(requestor, 'some-basis', false, logger);

    expect(result.type).toBe('changeSet');
    if (result.type === 'changeSet') {
      expect(result.payload.type).toBe('none');
      expect(result.payload.updates).toEqual([]);
    }
  });
});

describe('given a network error', () => {
  it('returns interrupted for synchronizer mode', async () => {
    const requestor = makeErrorRequestor(new Error('connection reset'));

    const result = await poll(requestor, undefined, false, logger);

    expect(result.type).toBe('status');
    if (result.type === 'status') {
      expect(result.state).toBe('interrupted');
      expect(result.errorInfo?.kind).toBe(DataSourceErrorKind.NetworkError);
      expect(result.errorInfo?.message).toBe('connection reset');
    }
  });

  it('returns terminal error for initializer mode', async () => {
    const requestor = makeErrorRequestor(new Error('connection reset'));

    const result = await poll(requestor, undefined, true, logger);

    expect(result.type).toBe('status');
    if (result.type === 'status') {
      expect(result.state).toBe('terminal_error');
      expect(result.errorInfo?.kind).toBe(DataSourceErrorKind.NetworkError);
    }
  });
});

describe('given an unrecoverable HTTP error', () => {
  it('returns terminal error for 401', async () => {
    const requestor = makeRequestor({
      status: 401,
      headers: makeHeaders(),
      body: null,
    });

    const result = await poll(requestor, undefined, false, logger);

    expect(result.type).toBe('status');
    if (result.type === 'status') {
      expect(result.state).toBe('terminal_error');
      expect(result.errorInfo?.statusCode).toBe(401);
    }
  });

  it('returns terminal error for 403', async () => {
    const requestor = makeRequestor({
      status: 403,
      headers: makeHeaders(),
      body: null,
    });

    const result = await poll(requestor, undefined, false, logger);

    if (result.type === 'status') {
      expect(result.state).toBe('terminal_error');
    }
  });
});

describe('given a recoverable HTTP error', () => {
  it('returns interrupted for synchronizer mode on 500', async () => {
    const requestor = makeRequestor({
      status: 500,
      headers: makeHeaders(),
      body: null,
    });

    const result = await poll(requestor, undefined, false, logger);

    expect(result.type).toBe('status');
    if (result.type === 'status') {
      expect(result.state).toBe('interrupted');
      expect(result.errorInfo?.statusCode).toBe(500);
    }
  });

  it('returns interrupted for synchronizer mode on 408', async () => {
    const requestor = makeRequestor({
      status: 408,
      headers: makeHeaders(),
      body: null,
    });

    const result = await poll(requestor, undefined, false, logger);

    if (result.type === 'status') {
      expect(result.state).toBe('interrupted');
    }
  });

  it('returns terminal error for initializer mode on 500', async () => {
    const requestor = makeRequestor({
      status: 500,
      headers: makeHeaders(),
      body: null,
    });

    const result = await poll(requestor, undefined, true, logger);

    if (result.type === 'status') {
      expect(result.state).toBe('terminal_error');
    }
  });
});

describe('given x-ld-fd-fallback header', () => {
  it('sets fdv1Fallback to true when header is true', async () => {
    const body = makeFullPayloadBody({ flagA: { value: true } });
    const requestor = makeRequestor({
      status: 200,
      headers: makeHeaders({ 'x-ld-fd-fallback': 'true' }),
      body,
    });

    const result = await poll(requestor, undefined, false, logger);

    expect(result.fdv1Fallback).toBe(true);
  });

  it('sets fdv1Fallback to false when header is absent', async () => {
    const body = makeFullPayloadBody({ flagA: { value: true } });
    const requestor = makeRequestor({
      status: 200,
      headers: makeHeaders(),
      body,
    });

    const result = await poll(requestor, undefined, false, logger);

    expect(result.fdv1Fallback).toBe(false);
  });

  it('sets fdv1Fallback on error responses too', async () => {
    const requestor = makeRequestor({
      status: 500,
      headers: makeHeaders({ 'x-ld-fd-fallback': 'true' }),
      body: null,
    });

    const result = await poll(requestor, undefined, false, logger);

    expect(result.fdv1Fallback).toBe(true);
  });
});

describe('given x-ld-envid header', () => {
  it('includes environmentId in changeSet result', async () => {
    const body = makeFullPayloadBody({ flagA: { value: true } });
    const requestor = makeRequestor({
      status: 200,
      headers: makeHeaders({ 'x-ld-envid': 'env-abc-123' }),
      body,
    });

    const result = await poll(requestor, undefined, false, logger);

    if (result.type === 'changeSet') {
      expect(result.environmentId).toBe('env-abc-123');
    }
  });

  it('includes environmentId in 304 result', async () => {
    const requestor = makeRequestor({
      status: 304,
      headers: makeHeaders({ 'x-ld-envid': 'env-abc-123' }),
      body: null,
    });

    const result = await poll(requestor, undefined, false, logger);

    if (result.type === 'changeSet') {
      expect(result.environmentId).toBe('env-abc-123');
    }
  });
});

describe('given malformed JSON response', () => {
  it('returns interrupted for synchronizer mode', async () => {
    const requestor = makeRequestor({
      status: 200,
      headers: makeHeaders(),
      body: '{invalid json',
    });

    const result = await poll(requestor, undefined, false, logger);

    if (result.type === 'status') {
      expect(result.state).toBe('interrupted');
      expect(result.errorInfo?.kind).toBe(DataSourceErrorKind.InvalidData);
    }
  });

  it('returns terminal error for initializer mode', async () => {
    const requestor = makeRequestor({
      status: 200,
      headers: makeHeaders(),
      body: '{invalid json',
    });

    const result = await poll(requestor, undefined, true, logger);

    if (result.type === 'status') {
      expect(result.state).toBe('terminal_error');
      expect(result.errorInfo?.kind).toBe(DataSourceErrorKind.InvalidData);
    }
  });
});

describe('given valid JSON without an events array', () => {
  it('returns InvalidData rather than NetworkError', async () => {
    const requestor = makeRequestor({
      status: 200,
      headers: makeHeaders(),
      body: '{"notEvents": true}',
    });

    const result = await poll(requestor, undefined, false, logger);

    expect(result.type).toBe('status');
    if (result.type === 'status') {
      expect(result.state).toBe('interrupted');
      expect(result.errorInfo?.kind).toBe(DataSourceErrorKind.InvalidData);
      expect(result.errorInfo?.message).toContain('missing or invalid events array');
    }
  });

  it('returns terminal error for initializer mode', async () => {
    const requestor = makeRequestor({
      status: 200,
      headers: makeHeaders(),
      body: '{"events": "not-an-array"}',
    });

    const result = await poll(requestor, undefined, true, logger);

    expect(result.type).toBe('status');
    if (result.type === 'status') {
      expect(result.state).toBe('terminal_error');
      expect(result.errorInfo?.kind).toBe(DataSourceErrorKind.InvalidData);
    }
  });
});

describe('given an empty response body', () => {
  it('returns an error result', async () => {
    const requestor = makeRequestor({
      status: 200,
      headers: makeHeaders(),
      body: null,
    });

    const result = await poll(requestor, undefined, false, logger);

    expect(result.type).toBe('status');
    if (result.type === 'status') {
      expect(result.errorInfo?.kind).toBe(DataSourceErrorKind.InvalidData);
    }
  });
});

describe('given a goodbye event in the response', () => {
  it('returns a goodbye result', async () => {
    const body = makeFDv2Body([
      {
        event: 'server-intent',
        data: {
          payloads: [{ id: 'test', target: 1, intentCode: 'xfer-full', reason: 'test' }],
        },
      },
      {
        event: 'goodbye',
        data: { reason: 'server-shutdown', silent: false, catastrophe: false },
      },
    ]);
    const requestor = makeRequestor({
      status: 200,
      headers: makeHeaders(),
      body,
    });

    const result = await poll(requestor, undefined, false, logger);

    expect(result.type).toBe('status');
    if (result.type === 'status') {
      expect(result.state).toBe('goodbye');
      expect(result.reason).toBe('server-shutdown');
    }
  });
});

describe('given a server error event in the response', () => {
  it('returns interrupted for synchronizer mode', async () => {
    const body = makeFDv2Body([
      {
        event: 'server-intent',
        data: {
          payloads: [{ id: 'test', target: 1, intentCode: 'xfer-full', reason: 'test' }],
        },
      },
      {
        event: 'error',
        data: { payload_id: 'test', reason: 'internal server error' },
      },
    ]);
    const requestor = makeRequestor({
      status: 200,
      headers: makeHeaders(),
      body,
    });

    const result = await poll(requestor, undefined, false, logger);

    expect(result.type).toBe('status');
    if (result.type === 'status') {
      expect(result.state).toBe('interrupted');
    }
  });
});

describe('given a response with no payload-transferred event', () => {
  it('returns an error when events produce no result', async () => {
    const body = makeFDv2Body([
      {
        event: 'server-intent',
        data: {
          payloads: [{ id: 'test', target: 1, intentCode: 'xfer-full', reason: 'test' }],
        },
      },
      // Missing put-object and payload-transferred events
    ]);
    const requestor = makeRequestor({
      status: 200,
      headers: makeHeaders(),
      body,
    });

    const result = await poll(requestor, undefined, false, logger);

    expect(result.type).toBe('status');
    if (result.type === 'status') {
      expect(result.errorInfo?.message).toBe('Unexpected end of polling response');
    }
  });
});

describe('given an intent with code none', () => {
  it('returns a changeSet with type none', async () => {
    const body = makeFDv2Body([
      {
        event: 'server-intent',
        data: {
          payloads: [{ id: 'test-payload', target: 1, intentCode: 'none', reason: 'up-to-date' }],
        },
      },
    ]);
    const requestor = makeRequestor({
      status: 200,
      headers: makeHeaders(),
      body,
    });

    const result = await poll(requestor, undefined, false, logger);

    expect(result.type).toBe('changeSet');
    if (result.type === 'changeSet') {
      expect(result.payload.type).toBe('none');
    }
  });
});

describe('given a partial (changes) transfer', () => {
  it('returns a changeSet with type partial', async () => {
    const body = makeFDv2Body([
      {
        event: 'server-intent',
        data: {
          payloads: [
            { id: 'test-payload', target: 2, intentCode: 'xfer-changes', reason: 'update' },
          ],
        },
      },
      {
        event: 'put-object',
        data: {
          kind: 'flagEval',
          key: 'updatedFlag',
          version: 5,
          object: { value: 'new-value', trackEvents: true },
        },
      },
      {
        event: 'payload-transferred',
        data: { state: 'new-state', version: 2, id: 'test-payload' },
      },
    ]);
    const requestor = makeRequestor({
      status: 200,
      headers: makeHeaders(),
      body,
    });

    const result = await poll(requestor, 'old-state', false, logger);

    expect(result.type).toBe('changeSet');
    if (result.type === 'changeSet') {
      expect(result.payload.type).toBe('partial');
      expect(result.payload.updates).toHaveLength(1);
      expect(result.payload.updates[0].key).toBe('updatedFlag');
      expect(result.payload.state).toBe('new-state');
    }
  });
});

describe('given a delete-object event', () => {
  it('includes the delete in the changeset updates', async () => {
    const body = makeFDv2Body([
      {
        event: 'server-intent',
        data: {
          payloads: [
            { id: 'test-payload', target: 2, intentCode: 'xfer-changes', reason: 'delete' },
          ],
        },
      },
      {
        event: 'delete-object',
        data: {
          kind: 'flagEval',
          key: 'deletedFlag',
          version: 3,
        },
      },
      {
        event: 'payload-transferred',
        data: { state: 'new-state', version: 2, id: 'test-payload' },
      },
    ]);
    const requestor = makeRequestor({
      status: 200,
      headers: makeHeaders(),
      body,
    });

    const result = await poll(requestor, 'old-state', false, logger);

    expect(result.type).toBe('changeSet');
    if (result.type === 'changeSet') {
      expect(result.payload.updates).toHaveLength(1);
      expect(result.payload.updates[0].key).toBe('deletedFlag');
      expect(result.payload.updates[0].deleted).toBe(true);
    }
  });
});
