import { LDOptions } from '../../src/api/options/LDOptions';
import LDClientImpl, { LDClientCallbacks } from '../../src/LDClientImpl';
import { createBasicPlatform } from '../createBasicPlatform';

/**
 * The body of an FDv2 polling response that transfers the given flags and segments as a full
 * payload with a selector, which is what makes the client initialize.
 */
export function fdv2FullPayload(
  flags: Record<string, any> = {},
  segments: Record<string, any> = {},
): string {
  const events: any[] = [
    {
      event: 'server-intent',
      data: { payloads: [{ intentCode: 'xfer-full', id: 'test-payload', target: 1 }] },
    },
  ];
  Object.entries(flags).forEach(([key, flag]) => {
    events.push({
      event: 'put-object',
      data: { kind: 'flag', key, version: flag.version, object: flag },
    });
  });
  Object.entries(segments).forEach(([key, segment]) => {
    events.push({
      event: 'put-object',
      data: { kind: 'segment', key, version: segment.version, object: segment },
    });
  });
  events.push({ event: 'payload-transferred', data: { state: 'test-state', version: 1 } });
  return JSON.stringify({ events });
}

/**
 * A platform whose polling requests return the given body. With no body, requests never
 * complete, so the client never initializes. Analytics event payloads posted to the events
 * endpoint are parsed and appended to capturedEvents, when it is given.
 */
export function makeFDv2Platform(body?: string, capturedEvents?: any[]) {
  const platform = createBasicPlatform();
  platform.requests.fetch = jest.fn((url: string, options?: { body?: string }) => {
    if (capturedEvents && url.includes('/bulk')) {
      capturedEvents.push(...JSON.parse(options?.body ?? '[]'));
      return Promise.resolve({
        status: 202,
        headers: new Headers(),
        text: async () => '',
      });
    }
    if (body === undefined) {
      return new Promise(() => {});
    }
    return Promise.resolve({
      status: 200,
      headers: new Headers(),
      text: async () => body,
    });
  });
  return platform;
}

/**
 * The summary counter that a flush produced for a flag, from captured analytics events.
 */
export function summaryCountersFor(capturedEvents: any[], flagKey: string): any[] {
  const summary = capturedEvents.find((event) => event.kind === 'summary');
  return summary?.features?.[flagKey]?.counters ?? [];
}

export function makeCallbacks(
  onUpdate: (key: string) => void = () => {},
  hasEventListeners: boolean = false,
): LDClientCallbacks {
  return {
    onError: jest.fn(),
    onFailed: jest.fn(),
    onReady: jest.fn(),
    onUpdate,
    hasEventListeners: () => hasEventListeners,
  };
}

/**
 * Creates a client that uses the FDv2 data system with a polling synchronizer, so that the mock
 * platform decides whether and with what data it initializes.
 */
export function makeFDv2Client(
  platform: ReturnType<typeof makeFDv2Platform>,
  options: LDOptions,
  callbacks: LDClientCallbacks = makeCallbacks(),
): LDClientImpl {
  return new LDClientImpl(
    'sdk-key-overrides',
    platform,
    {
      sendEvents: false,
      diagnosticOptOut: true,
      ...options,
      dataSystem: {
        dataSource: {
          dataSourceOptionsType: 'custom',
          initializers: [],
          synchronizers: [{ type: 'polling', pollInterval: 1000 }],
        },
        ...options.dataSystem,
      },
    },
    callbacks,
  );
}

export function singleValueFlag(key: string, value: any, version: number = 1): any {
  return {
    key,
    version,
    on: false,
    offVariation: 0,
    fallthrough: { variation: 0 },
    variations: [value],
  };
}
