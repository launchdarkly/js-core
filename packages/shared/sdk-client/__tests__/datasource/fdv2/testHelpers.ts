import { FDv2PollResponse, FDv2Requestor } from '../../../src/datasource/fdv2/FDv2Requestor';

export function makeHeaders(extra: Record<string, string> = {}): {
  get(name: string): string | null;
} {
  const headers: Record<string, string> = { ...extra };
  return {
    get(name: string): string | null {
      return headers[name.toLowerCase()] ?? null;
    },
  };
}

export function makeFDv2Body(events: any[]): string {
  return JSON.stringify({ events });
}

export function makeFullPayloadBody(
  flags: Record<string, { value: any; trackEvents?: boolean }>,
  state: string = 'test-state',
): string {
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
    data: { state, version: 1, id: 'test-payload' },
  });

  return JSON.stringify({ events });
}

export function makeSuccessResponse(
  flags: Record<string, { value: any }>,
  state: string = 'test-state',
): FDv2PollResponse {
  return {
    status: 200,
    headers: makeHeaders(),
    body: makeFullPayloadBody(flags, state),
  };
}

export function makeRequestor(response: FDv2PollResponse): FDv2Requestor {
  return {
    poll: jest.fn().mockResolvedValue(response),
  };
}

export function makeErrorRequestor(error: Error): FDv2Requestor {
  return {
    poll: jest.fn().mockRejectedValue(error),
  };
}

export function makeLogger() {
  return {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
}
