import { LDLogger } from '@launchdarkly/js-sdk-common';

import { LDOptions } from '../src/api/options/LDOptions';
import LDClientImpl from '../src/LDClientImpl';
import { createBasicPlatform } from './createBasicPlatform';

function makeEventSource() {
  return {
    onopen: jest.fn(),
    onclose: jest.fn(),
    onerror: jest.fn(),
    onretrying: jest.fn(),
    addEventListener: jest.fn(),
    close: jest.fn(),
  };
}

function requestUrls(platform: any): string[] {
  return [
    ...platform.requests.fetch.mock.calls.map((c: any[]) => c[0] as string),
    ...platform.requests.createEventSource.mock.calls.map((c: any[]) => c[0] as string),
  ];
}

describe('given a client using the FDv2 data system', () => {
  const callbacks = {
    onFailed: jest.fn(),
    onError: jest.fn(),
    onReady: jest.fn(),
    onUpdate: jest.fn(),
    hasEventListeners: jest.fn(),
  };
  let platform: any;
  let logger: LDLogger;
  let client: LDClientImpl;

  function makeOptions(overrides: LDOptions = {}): LDOptions {
    return {
      sendEvents: false,
      diagnosticOptOut: true,
      logger,
      dataSystem: {
        dataSource: {
          dataSourceOptionsType: 'custom',
          initializers: [],
          synchronizers: [],
        },
      },
      ...overrides,
    };
  }

  beforeEach(() => {
    platform = createBasicPlatform();
    // The requestor records the URL before it awaits the response, so a failed request is
    // enough to observe the URL.
    platform.requests.fetch = jest.fn(async () => {
      throw new Error('no network in test');
    });
    platform.requests.createEventSource = jest.fn(() => makeEventSource());
    logger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };
  });

  afterEach(() => {
    client?.close();
    jest.resetAllMocks();
  });

  it('warns when a payload filter key is configured', () => {
    client = new LDClientImpl(
      'sdk-key',
      platform,
      makeOptions({ payloadFilterKey: 'microservice-1' }),
      callbacks,
    );

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Payload filtering is not supported with the FDv2 data system'),
    );
  });

  it('does not warn when no payload filter key is configured', () => {
    client = new LDClientImpl('sdk-key', platform, makeOptions(), callbacks);

    expect(logger.warn).not.toHaveBeenCalledWith(
      expect.stringContaining('Payload filtering is not supported'),
    );
  });

  it.each<[string, NonNullable<LDOptions['dataSystem']>['dataSource'], string]>([
    [
      'a polling initializer',
      {
        dataSourceOptionsType: 'custom',
        initializers: [{ type: 'polling' }],
        synchronizers: [],
      },
      'https://sdk.launchdarkly.com/sdk/poll',
    ],
    [
      'a polling initializer with a per-source base URI',
      {
        dataSourceOptionsType: 'custom',
        initializers: [{ type: 'polling', baseUri: 'https://custom-poll.example.com' }],
        synchronizers: [],
      },
      'https://custom-poll.example.com/sdk/poll',
    ],
    [
      'a polling synchronizer',
      {
        dataSourceOptionsType: 'custom',
        initializers: [],
        synchronizers: [{ type: 'polling' }],
      },
      'https://sdk.launchdarkly.com/sdk/poll',
    ],
    [
      'a polling synchronizer with a per-source base URI',
      {
        dataSourceOptionsType: 'custom',
        initializers: [],
        synchronizers: [{ type: 'polling', baseUri: 'https://custom-poll.example.com' }],
      },
      'https://custom-poll.example.com/sdk/poll',
    ],
    [
      'a streaming synchronizer',
      {
        dataSourceOptionsType: 'custom',
        initializers: [],
        synchronizers: [{ type: 'streaming' }],
      },
      'https://stream.launchdarkly.com/sdk/stream',
    ],
    [
      'a streaming synchronizer with a per-source base URI',
      {
        dataSourceOptionsType: 'custom',
        initializers: [],
        synchronizers: [{ type: 'streaming', baseUri: 'https://custom-stream.example.com' }],
      },
      'https://custom-stream.example.com/sdk/stream',
    ],
    [
      'the standard data source',
      { dataSourceOptionsType: 'standard' },
      'https://sdk.launchdarkly.com/sdk/poll',
    ],
    [
      'the streaming only data source',
      { dataSourceOptionsType: 'streamingOnly' },
      'https://stream.launchdarkly.com/sdk/stream',
    ],
    [
      'the polling only data source',
      { dataSourceOptionsType: 'pollingOnly' },
      'https://sdk.launchdarkly.com/sdk/poll',
    ],
  ])(
    'does not send the payload filter on requests from %s',
    async (_name, dataSource, expectedUrlPrefix) => {
      client = new LDClientImpl(
        'sdk-key',
        platform,
        makeOptions({ payloadFilterKey: 'microservice-1', dataSystem: { dataSource } }),
        callbacks,
      );

      // Wait briefly so that the first data source makes its request.
      await client.waitForInitialization({ timeout: 0.02 }).catch(() => {});

      // The FDv2 request goes to the expected host and has no filter parameter.
      const urls = requestUrls(platform);
      expect(urls.some((u) => u.startsWith(expectedUrlPrefix))).toBe(true);
      urls.forEach((u) => expect(u).not.toContain('filter='));
    },
  );

  it('sends no filter parameter on FDv2 requests when no payload filter key is configured', async () => {
    client = new LDClientImpl(
      'sdk-key',
      platform,
      makeOptions({ dataSystem: { dataSource: { dataSourceOptionsType: 'standard' } } }),
      callbacks,
    );

    // Wait briefly so that the polling initializer makes its request.
    await client.waitForInitialization({ timeout: 0.02 }).catch(() => {});

    // The FDv2 request goes out without a filter parameter.
    const urls = requestUrls(platform);
    expect(urls.some((u) => u.includes('/sdk/poll'))).toBe(true);
    urls.forEach((u) => expect(u).not.toContain('filter='));
  });

  it.each([
    ['the default host', undefined, 'https://sdk.launchdarkly.com/sdk/latest-all'],
    [
      'a custom base URI',
      { baseUri: 'https://fallback.example.com' },
      'https://fallback.example.com/sdk/latest-all',
    ],
  ])(
    'sends the payload filter on requests from the FDv1 fallback synchronizer with %s',
    async (_name, fdv1Fallback, expectedUrlPrefix) => {
      platform.requests.fetch = jest.fn(async (url: string) => {
        const fallback = url.includes('/sdk/poll');
        const headers = new Map(fallback ? [['x-ld-fd-fallback', 'true']] : []);
        return {
          status: fallback ? 500 : 200,
          headers,
          text: async () => (fallback ? '' : JSON.stringify({ flags: {}, segments: {} })),
        };
      });
      client = new LDClientImpl(
        'sdk-key',
        platform,
        makeOptions({
          payloadFilterKey: 'microservice-1',
          dataSystem: {
            dataSource: {
              dataSourceOptionsType: 'custom',
              initializers: [{ type: 'polling' }],
              synchronizers: [{ type: 'polling' }],
            },
            fdv1Fallback,
          },
        }),
        callbacks,
      );

      // The FDv2 initializer response directs the SDK to the FDv1 fallback synchronizer.
      await client.waitForInitialization({ timeout: 1 });

      // Only the FDv1 fallback request carries the filter, and it goes to the expected host.
      const urls = requestUrls(platform);
      const fdv1Urls = urls.filter((u) => u.includes('/sdk/latest-all'));
      expect(fdv1Urls.length).toBeGreaterThan(0);
      fdv1Urls.forEach((u) => {
        expect(u.startsWith(expectedUrlPrefix)).toBe(true);
        expect(u).toContain('filter=microservice-1');
      });
      urls
        .filter((u) => u.includes('/sdk/poll'))
        .forEach((u) => expect(u).not.toContain('filter='));
    },
  );
});

describe('given a client using the FDv1 data system', () => {
  const callbacks = {
    onFailed: jest.fn(),
    onError: jest.fn(),
    onReady: jest.fn(),
    onUpdate: jest.fn(),
    hasEventListeners: jest.fn(),
  };
  let platform: any;
  let client: LDClientImpl;

  beforeEach(() => {
    platform = createBasicPlatform();
    platform.requests.fetch = jest.fn(async () => {
      throw new Error('no network in test');
    });
    platform.requests.createEventSource = jest.fn(() => makeEventSource());
  });

  afterEach(() => {
    client?.close();
    jest.resetAllMocks();
  });

  it.each([
    ['polling', false, '/sdk/latest-all'],
    ['streaming', true, '/all'],
  ])('sends the payload filter on %s requests', async (_name, stream, expectedPath) => {
    client = new LDClientImpl(
      'sdk-key',
      platform,
      {
        sendEvents: false,
        diagnosticOptOut: true,
        stream,
        payloadFilterKey: 'microservice-1',
      },
      callbacks,
    );

    // Wait briefly so that the data source makes its request.
    await client.waitForInitialization({ timeout: 0.02 }).catch(() => {});

    // The FDv1 request carries the filter.
    const urls = requestUrls(platform).filter((u) => u.includes(expectedPath));
    expect(urls.length).toBeGreaterThan(0);
    urls.forEach((u) => expect(u).toContain('filter=microservice-1'));
  });
});
