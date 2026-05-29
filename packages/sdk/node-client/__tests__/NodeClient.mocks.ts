import type {
  EventSource,
  EventSourceCapabilities,
  EventSourceInitDict,
  Platform,
  PlatformData,
  Requests,
  Response,
  SdkData,
} from '@launchdarkly/js-client-sdk-common';

function mockResponse(value: string, statusCode: number): Promise<Response> {
  const response: Response = {
    headers: {
      get: jest.fn(() => null),
      keys: jest.fn(),
      values: jest.fn(),
      entries: jest.fn(),
      has: jest.fn(),
    },
    status: statusCode,
    text: () => Promise.resolve(value),
    json: () => Promise.resolve(JSON.parse(value)),
  };
  return Promise.resolve(response);
}

export function mockFetch(value: string, statusCode: number = 200): jest.Mock {
  const f = jest.fn();
  f.mockResolvedValue(mockResponse(value, statusCode));
  return f;
}

export interface MockEventSource extends EventSource {
  streamUri?: string;
  options?: EventSourceInitDict;
}

export function makeMockEventSource(streamUri: string = '', options?: EventSourceInitDict): MockEventSource {
  return {
    streamUri,
    options,
    addEventListener: jest.fn(),
    close: jest.fn(),
    onclose: jest.fn(),
    onerror: jest.fn(),
    onopen: jest.fn(),
    onretrying: jest.fn(),
  } as unknown as MockEventSource;
}

export function makeMockRequests(): Requests {
  return {
    fetch: mockFetch('{"flagA": true}', 200),
    createEventSource: jest.fn((streamUri: string, options: EventSourceInitDict) =>
      makeMockEventSource(streamUri, options),
    ),
    getEventSourceCapabilities: (): EventSourceCapabilities => ({
      readTimeout: false,
      headers: true,
      customMethod: false,
    }),
  };
}

export interface MockPlatformOptions {
  wrapperName?: string;
  wrapperVersion?: string;
  requests?: Requests;
}

export function makeMockPlatform(options: MockPlatformOptions = {}): Platform {
  const requests = options.requests ?? makeMockRequests();
  return {
    requests,
    info: {
      platformData(): PlatformData {
        return { name: 'Node' };
      },
      sdkData(): SdkData {
        const sdkData: SdkData = {
          name: 'node-client-sdk',
          version: '0.0.1',
          userAgentBase: 'NodeClient',
        };
        if (options.wrapperName) {
          sdkData.wrapperName = options.wrapperName;
        }
        if (options.wrapperVersion) {
          sdkData.wrapperVersion = options.wrapperVersion;
        }
        return sdkData;
      },
    },
    crypto: {
      createHash: () => ({
        update: () => ({ digest: () => 'mock-digest' }),
        digest: () => 'mock-digest',
      }),
      randomUUID: () => 'mock-uuid',
    },
    storage: {
      get: jest.fn(async (_key: string) => null),
      set: jest.fn(async (_key: string, _value: string) => {}),
      clear: jest.fn(async (_key: string) => {}),
    },
    encoding: {
      btoa: (str: string) => Buffer.from(str).toString('base64'),
    },
  } as unknown as Platform;
}
