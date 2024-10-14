import { jest } from '@jest/globals';

import {
  AutoEnvAttributes,
  EventSourceCapabilities,
  EventSourceInitDict,
  LDLogger,
  PlatformData,
  Requests,
  SdkData,
} from '@launchdarkly/js-client-sdk-common';

import { BrowserClient } from '../src/BrowserClient';
import { MockHasher } from './MockHasher';
import { goodBootstrapDataWithReasons } from './testBootstrapData';

function mockResponse(value: string, statusCode: number) {
  const response: Response = {
    headers: {
      // @ts-ignore
      get: jest.fn(),
      // @ts-ignore
      keys: jest.fn(),
      // @ts-ignore
      values: jest.fn(),
      // @ts-ignore
      entries: jest.fn(),
      // @ts-ignore
      has: jest.fn(),
    },
    status: statusCode,
    text: () => Promise.resolve(value),
    json: () => Promise.resolve(JSON.parse(value)),
  };
  return Promise.resolve(response);
}

function mockFetch(value: string, statusCode: number = 200) {
  const f = jest.fn();
  // @ts-ignore
  f.mockResolvedValue(mockResponse(value, statusCode));
  return f;
}

function makeRequests(): Requests {
  return {
    // @ts-ignore
    fetch: jest.fn((url: string, _options: any) => {
      if (url.includes('/sdk/goals/')) {
        return mockFetch(
          JSON.stringify([
            {
              key: 'pageview',
              kind: 'pageview',
              urls: [{ kind: 'exact', url: 'http://browserclientintegration.com' }],
            },
            {
              key: 'click',
              kind: 'click',
              selector: '.button',
              urls: [{ kind: 'exact', url: 'http://browserclientintegration.com' }],
            },
          ]),
          200,
        )();
      }
      return mockFetch('{ "flagA": true }', 200)();
    }),
    // @ts-ignore
    createEventSource(_url: string, _eventSourceInitDict: EventSourceInitDict): EventSource {
      throw new Error('Function not implemented.');
    },
    getEventSourceCapabilities(): EventSourceCapabilities {
      return {
        readTimeout: false,
        headers: false,
        customMethod: false,
      };
    },
  };
}

describe('given a mock platform for a BrowserClient', () => {
  const logger: LDLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  let platform: any;
  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      value: { href: 'http://browserclientintegration.com' },
      writable: true,
    });
    jest.useFakeTimers().setSystemTime(new Date('2024-09-19'));
    platform = {
      requests: makeRequests(),
      info: {
        platformData(): PlatformData {
          return {
            name: 'node',
          };
        },
        sdkData(): SdkData {
          return {
            name: 'browser-sdk',
            version: '1.0.0',
          };
        },
      },
      crypto: {
        createHash: () => new MockHasher(),
        randomUUID: () => '123',
      },
      storage: {
        get: async (_key: string) => null,
        set: async (_key: string, _value: string) => {},
        clear: async (_key: string) => {},
      },
      encoding: {
        btoa: (str: string) => str,
      },
    };
  });

  it('includes urls in custom events', async () => {
    const client = new BrowserClient(
      'client-side-id',
      AutoEnvAttributes.Disabled,
      {
        streaming: false,
        logger,
        diagnosticOptOut: true,
      },
      platform,
    );
    await client.identify({ key: 'user-key', kind: 'user' });
    await client.flush();
    client.track('user-key', undefined, 1);
    await client.flush();

    expect(JSON.parse(platform.requests.fetch.mock.calls[3][1].body)[0]).toMatchObject({
      kind: 'custom',
      creationDate: 1726704000000,
      key: 'user-key',
      contextKeys: {
        user: 'user-key',
      },
      metricValue: 1,
      url: 'http://browserclientintegration.com',
    });
  });

  it('can filter URLs in custom events', async () => {
    const client = new BrowserClient(
      'client-side-id',
      AutoEnvAttributes.Disabled,
      {
        streaming: false,
        logger,
        diagnosticOptOut: true,
        eventUrlTransformer: (url: string) =>
          url.replace('http://browserclientintegration.com', 'http://filtered.org'),
      },
      platform,
    );
    await client.identify({ key: 'user-key', kind: 'user' });
    await client.flush();
    client.track('user-key', undefined, 1);
    await client.flush();

    const events = JSON.parse(platform.requests.fetch.mock.calls[3][1].body);
    const customEvent = events.find((e: any) => e.kind === 'custom');

    expect(customEvent).toMatchObject({
      kind: 'custom',
      creationDate: 1726704000000,
      key: 'user-key',
      contextKeys: {
        user: 'user-key',
      },
      metricValue: 1,
      url: 'http://filtered.org',
    });
  });

  it('can filter URLs in click events', async () => {
    const client = new BrowserClient(
      'client-side-id',
      AutoEnvAttributes.Disabled,
      {
        streaming: false,
        logger,
        diagnosticOptOut: true,
        eventUrlTransformer: (url: string) =>
          url.replace('http://browserclientintegration.com', 'http://filtered.org'),
      },
      platform,
    );
    await client.identify({ key: 'user-key', kind: 'user' });
    await client.flush();

    // Simulate a click event
    const button = document.createElement('button');
    button.className = 'button';
    document.body.appendChild(button);
    button.click();

    while (platform.requests.fetch.mock.calls.length < 4) {
      // eslint-disable-next-line no-await-in-loop
      await client.flush();
      jest.runAllTicks();
    }

    const events = JSON.parse(platform.requests.fetch.mock.calls[3][1].body);
    const clickEvent = events.find((e: any) => e.kind === 'click');
    expect(clickEvent).toMatchObject({
      kind: 'click',
      creationDate: 1726704000000,
      key: 'click',
      contextKeys: {
        user: 'user-key',
      },
      url: 'http://filtered.org',
    });

    document.body.removeChild(button);
  });

  it('can filter URLs in pageview events', async () => {
    const client = new BrowserClient(
      'client-side-id',
      AutoEnvAttributes.Disabled,
      {
        streaming: false,
        logger,
        diagnosticOptOut: true,
        eventUrlTransformer: (url: string) =>
          url.replace('http://browserclientintegration.com', 'http://filtered.com'),
      },
      platform,
    );

    await client.identify({ key: 'user-key', kind: 'user' });
    await client.flush();

    const events = JSON.parse(platform.requests.fetch.mock.calls[2][1].body);
    const pageviewEvent = events.find((e: any) => e.kind === 'pageview');
    expect(pageviewEvent).toMatchObject({
      kind: 'pageview',
      creationDate: 1726704000000,
      key: 'pageview',
      contextKeys: {
        user: 'user-key',
      },
      url: 'http://filtered.com',
    });
  });

  it('can use bootstrap data', async () => {
    const client = new BrowserClient(
      'client-side-id',
      AutoEnvAttributes.Disabled,
      {
        streaming: false,
        logger,
        diagnosticOptOut: true,
      },
      platform,
    );
    await client.identify(
      { kind: 'user', key: 'bob' },
      {
        bootstrap: goodBootstrapDataWithReasons,
      },
    );

    expect(client.jsonVariationDetail('json', undefined)).toEqual({
      reason: {
        kind: 'OFF',
      },
      value: ['a', 'b', 'c', 'd'],
      variationIndex: 1,
    });
  });
});
