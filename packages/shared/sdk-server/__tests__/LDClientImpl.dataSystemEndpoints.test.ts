import { LDOptions } from '../src/api/options/LDOptions';
import LDClientImpl from '../src/LDClientImpl';
import { createBasicPlatform } from './createBasicPlatform';

describe('given a custom FDv2 data system with per-source base URIs', () => {
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
    // Failing the request is fine - the Requestor records the URL synchronously,
    // before awaiting the response, so we can still assert on the target URL.
    platform.requests.fetch = jest.fn(async () => {
      throw new Error('no network in test');
    });
    // Minimal event-source mock so a streaming source can open without throwing.
    platform.requests.createEventSource = jest.fn(() => ({
      onopen: jest.fn(),
      onclose: jest.fn(),
      onerror: jest.fn(),
      onretrying: jest.fn(),
      addEventListener: jest.fn(),
      close: jest.fn(),
    }));
  });

  afterEach(() => {
    client?.close();
    jest.resetAllMocks();
  });

  it('routes a polling initializer to its per-source baseUri instead of the shared endpoint', async () => {
    const options: LDOptions = {
      sendEvents: false,
      diagnosticOptOut: true,
      dataSystem: {
        dataSource: {
          dataSourceOptionsType: 'custom',
          initializers: [{ type: 'polling', baseUri: 'https://custom-init.example.com' }],
          synchronizers: [],
        },
      },
    };
    client = new LDClientImpl('sdk-key', platform, options, callbacks);
    await client.waitForInitialization({ timeout: 20 }).catch(() => {});

    expect(platform.requests.fetch).toHaveBeenCalled();
    const urls: string[] = platform.requests.fetch.mock.calls.map((c: any[]) => c[0] as string);
    expect(urls.some((u) => u.startsWith('https://custom-init.example.com'))).toBe(true);
  });

  it('routes a streaming synchronizer to its per-source baseUri instead of the shared endpoint', async () => {
    const options: LDOptions = {
      sendEvents: false,
      diagnosticOptOut: true,
      dataSystem: {
        dataSource: {
          dataSourceOptionsType: 'custom',
          initializers: [],
          synchronizers: [{ type: 'streaming', baseUri: 'https://custom-stream.example.com' }],
        },
      },
    };
    client = new LDClientImpl('sdk-key', platform, options, callbacks);
    // NOTE: `timeout` is in seconds (see LDWaitForInitializationOptions). Unlike the polling
    // initializer test above, nothing here ever resolves/rejects initialization (the mocked
    // createEventSource never fires onopen/onerror), so a `timeout: 20` (20 real seconds) would
    // hang past jest's default per-test timeout. Use a short real timeout instead.
    await client.waitForInitialization({ timeout: 0.02 }).catch(() => {});

    expect(platform.requests.createEventSource).toHaveBeenCalled();
    const urls: string[] = platform.requests.createEventSource.mock.calls.map(
      (c: any[]) => c[0] as string,
    );
    expect(urls.some((u) => u.startsWith('https://custom-stream.example.com'))).toBe(true);
  });
});
