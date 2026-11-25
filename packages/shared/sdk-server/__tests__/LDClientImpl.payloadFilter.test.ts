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

    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      'Payload filtering is not supported with the FDv2 data system; the configured payload filter has no effect on FDv2 requests',
    );
  });

  it('does not warn when no payload filter key is configured', () => {
    client = new LDClientImpl('sdk-key', platform, makeOptions(), callbacks);

    expect(logger.warn).not.toHaveBeenCalledWith(
      expect.stringContaining('Payload filtering is not supported'),
    );
  });

  it.each([
    ['the default host', undefined, 'https://sdk.launchdarkly.com/sdk/latest-all'],
    [
      'a custom base URI',
      { baseUri: 'https://fallback.example.com' },
      'https://fallback.example.com/sdk/latest-all',
    ],
  ])(
    'uses the unfiltered FDv1 fallback endpoint with %s',
    async (_name, fdv1Fallback, expectedUrl) => {
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

      const urls = requestUrls(platform);
      const fdv1Urls = urls.filter((u) => u.includes('/sdk/latest-all'));
      expect(fdv1Urls.length).toBeGreaterThan(0);
      fdv1Urls.forEach((u) => {
        expect(u).toBe(expectedUrl);
      });
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
