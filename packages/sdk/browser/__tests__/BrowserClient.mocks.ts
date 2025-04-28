import {
  EventSourceCapabilities,
  EventSourceInitDict,
  Platform,
  PlatformData,
  Requests,
  SdkData,
} from '@launchdarkly/js-client-sdk-common';

import { BrowserOptions } from '../src/options';
import { MockHasher } from './MockHasher';

function mockResponse(value: string, statusCode: number) {
  const response: Response = {
    // @ts-ignore
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

export function makeRequests(): Requests {
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

export function makeBasicPlatform(options?: BrowserOptions): Platform {
  return {
    requests: makeRequests(),
    info: {
      platformData(): PlatformData {
        return {
          name: 'browser',
        };
      },
      sdkData(): SdkData {
        const sdkData: SdkData = {
          name: 'browser-sdk',
          version: '1.0.0',
          userAgentBase: 'MockBrowserSDK',
        };
        if (options?.wrapperName) {
          sdkData.wrapperName = options.wrapperName;
        }
        if (options?.wrapperVersion) {
          sdkData.wrapperVersion = options.wrapperVersion;
        }
        return sdkData;
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
  } as Platform;
}
