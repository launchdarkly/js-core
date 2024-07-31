import {
  AutoEnvAttributes,
  BasicLogger,
  type LDContext,
  LDLogger,
  Response,
} from '@launchdarkly/js-client-sdk-common';

import createPlatform from './platform';
import PlatformCrypto from './platform/crypto';
import PlatformEncoding from './platform/PlatformEncoding';
import PlatformInfo from './platform/PlatformInfo';
import PlatformStorage from './platform/PlatformStorage';
import ReactNativeLDClient from './ReactNativeLDClient';

function mockResponse(value: string, statusCode: number) {
  const response: Response = {
    headers: {
      get: jest.fn(),
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

/**
 * Mocks basicPlatform fetch. Returns the fetch jest.Mock object.
 * @param remoteJson
 * @param statusCode
 */
function mockFetch(value: string, statusCode: number = 200) {
  const f = jest.fn();
  f.mockResolvedValue(mockResponse(value, statusCode));
  return f;
}

jest.mock('./platform', () => ({
  __esModule: true,
  default: jest.fn((logger: LDLogger) => ({
    crypto: new PlatformCrypto(),
    info: new PlatformInfo(logger),
    requests: {
      createEventSource: jest.fn(),
      fetch: jest.fn(),
    },
    encoding: new PlatformEncoding(),
    storage: new PlatformStorage(logger),
  })),
  // default: (logger: LDLogger) => ({
  //   crypto: new PlatformCrypto(),
  //   info: new PlatformInfo(logger),
  //   requests: {
  //     createEventSource: jest.fn(),
  //     fetch: jest.fn(),
  //   },
  //   encoding: new PlatformEncoding(),
  //   storage: new PlatformStorage(logger),
  // }),
}));

// let ldc: ReactNativeLDClient;

// beforeEach(() => {
//   ldc = new ReactNativeLDClient('mobile-key', AutoEnvAttributes.Enabled, { sendEvents: false });
// });

// test('constructing a new client', () => {
//   expect(ldc.highTimeoutThreshold).toEqual(15);
//   expect(ldc.sdkKey).toEqual('mobile-key');
//   expect(ldc.config.serviceEndpoints).toEqual({
//     analyticsEventPath: '/mobile',
//     diagnosticEventPath: '/mobile/events/diagnostic',
//     events: 'https://events.launchdarkly.com',
//     includeAuthorizationHeader: true,
//     polling: 'https://clientsdk.launchdarkly.com',
//     streaming: 'https://clientstream.launchdarkly.com',
//   });
// });

it('uses correct default diagnostic url', () => {
  const mockedFetch = jest.fn();
  const logger: LDLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
  (createPlatform as jest.Mock).mockReturnValue({
    crypto: new PlatformCrypto(),
    info: new PlatformInfo(logger),
    requests: {
      createEventSource: jest.fn(),
      fetch: mockedFetch,
    },
    encoding: new PlatformEncoding(),
    storage: new PlatformStorage(logger),
  });
  const client = new ReactNativeLDClient('mobile-key', AutoEnvAttributes.Enabled);

  expect(mockedFetch).toHaveBeenCalledWith(
    'https://events.launchdarkly.com/mobile/events/diagnostic',
    expect.anything(),
  );
  client.close();
});

it('uses correct default analytics event url', async () => {
  const mockedFetch = jest.fn();
  const logger: LDLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
  (createPlatform as jest.Mock).mockReturnValue({
    crypto: new PlatformCrypto(),
    info: new PlatformInfo(logger),
    requests: {
      createEventSource: jest.fn(),
      fetch: mockedFetch,
    },
    encoding: new PlatformEncoding(),
    storage: new PlatformStorage(logger),
  });
  const client = new ReactNativeLDClient('mobile-key', AutoEnvAttributes.Enabled, {
    diagnosticOptOut: true,
  });
  await client.identify({ kind: 'user', key: 'bob' });
  await client.flush();

  expect(mockedFetch).toHaveBeenCalledWith(
    'https://events.launchdarkly.com/mobile',
    expect.anything(),
  );
});

it('uses correct default polling url', async () => {
  const mockedFetch = mockFetch('{"flagA": true}', 200);
  const logger: LDLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
  (createPlatform as jest.Mock).mockReturnValue({
    crypto: new PlatformCrypto(),
    info: new PlatformInfo(logger),
    requests: {
      createEventSource: jest.fn(),
      fetch: mockedFetch,
    },
    encoding: new PlatformEncoding(),
    storage: new PlatformStorage(logger),
  });
  const client = new ReactNativeLDClient('mobile-key', AutoEnvAttributes.Enabled, {
    diagnosticOptOut: true,
    sendEvents: false,
    initialConnectionMode: 'polling',
    automaticBackgroundHandling: false,
  });
  await client.identify({ kind: 'user', key: 'bob' });

  const regex = /https:\/\/clientsdk.launchdarkly.com\/msdk\/evalx\/contexts\/.*/;
  expect(mockedFetch).toHaveBeenCalledWith(expect.stringMatching(regex), expect.anything());
});

it('uses correct default streaming url', () => {});

it('includes authorization header', () => {});

it('identify with too high of a timeout', () => {
  const logger: LDLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
  const client = new ReactNativeLDClient('mobile-key', AutoEnvAttributes.Enabled, {
    sendEvents: false,
    initialConnectionMode: 'offline',
    logger,
  });
  client.identify({ key: 'potato', kind: 'user' }, { timeout: 16 });
  expect(logger.warn).toHaveBeenCalledWith(
    'The identify function was called with a timeout greater than 15 seconds. We recommend a timeout of less than 15 seconds.',
  );
});

it('identify timeout equal to threshold', () => {
  const logger: LDLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
  const client = new ReactNativeLDClient('mobile-key', AutoEnvAttributes.Enabled, {
    sendEvents: false,
    initialConnectionMode: 'offline',
    logger,
  });
  client.identify({ key: 'potato', kind: 'user' }, { timeout: 15 });
  expect(logger.warn).not.toHaveBeenCalled();
});
