import type { LDLogger, Response } from '@launchdarkly/js-client-sdk-common';

import { ElectronLDMainClient } from '../src/ElectronLDMainClient';
import ElectronCrypto from '../src/platform/ElectronCrypto';
import ElectronEncoding from '../src/platform/ElectronEncoding';
import ElectronInfo from '../src/platform/ElectronInfo';
import ElectronPlatform from '../src/platform/ElectronPlatform';

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
 * Mocks fetch. Returns the fetch jest.Mock object.
 * @param remoteJson
 * @param statusCode
 */
function mockFetch(value: string, statusCode: number = 200) {
  const f = jest.fn();
  f.mockResolvedValue(mockResponse(value, statusCode));
  return f;
}

jest.mock('../src/platform/ElectronPlatform', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    crypto: new ElectronCrypto(),
    info: new ElectronInfo(),
    requests: {
      createEventSource: jest.fn(),
      fetch: jest.fn(),
      getEventSourceCapabilities: jest.fn(),
    },
    encoding: new ElectronEncoding(),
    storage: {
      clear: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
    },
  })),
}));

const createMockEventSource = (streamUri: string = '', options: any = {}) => ({
  streamUri,
  options,
  onclose: jest.fn(),
  addEventListener: jest.fn(),
  close: jest.fn(),
});

beforeAll(() => {
  jest.useFakeTimers();
});

beforeEach(() => {
  jest.clearAllMocks();
});

it('uses correct default diagnostic url', () => {
  const mockedFetch = jest.fn();
  (ElectronPlatform as jest.Mock).mockReturnValue({
    crypto: new ElectronCrypto(),
    info: new ElectronInfo(),
    requests: {
      createEventSource: jest.fn(),
      fetch: mockedFetch,
      getEventSourceCapabilities: jest.fn(),
    },
    encoding: new ElectronEncoding(),
    storage: {
      clear: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
    },
  });
  const client = new ElectronLDMainClient('client-side-id', { registerInMain: false });

  expect(mockedFetch).toHaveBeenCalledWith(
    'https://events.launchdarkly.com/events/diagnostic/client-side-id',
    expect.anything(),
  );
  client.close();
});

it('uses correct default analytics event url', async () => {
  const mockedFetch = mockFetch('{"flagA": true}', 200);
  (ElectronPlatform as jest.Mock).mockReturnValue({
    crypto: new ElectronCrypto(),
    info: new ElectronInfo(),
    requests: {
      createEventSource: createMockEventSource,
      fetch: mockedFetch,
      getEventSourceCapabilities: jest.fn(),
    },
    encoding: new ElectronEncoding(),
    storage: {
      clear: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
    },
  });
  const client = new ElectronLDMainClient('client-side-id', {
    registerInMain: false,
    diagnosticOptOut: true,
    initialConnectionMode: 'polling',
  });
  await client.identify({ kind: 'user', key: 'bob' });
  await client.flush();

  expect(mockedFetch).toHaveBeenCalledWith(
    'https://events.launchdarkly.com/events/bulk/client-side-id',
    expect.anything(),
  );
});

it('uses correct default polling url', async () => {
  const mockedFetch = mockFetch('{"flagA": true}', 200);
  (ElectronPlatform as jest.Mock).mockReturnValue({
    crypto: new ElectronCrypto(),
    info: new ElectronInfo(),
    requests: {
      createEventSource: jest.fn(),
      fetch: mockedFetch,
      getEventSourceCapabilities: jest.fn(),
    },
    encoding: new ElectronEncoding(),
    storage: {
      clear: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
    },
  });
  const client = new ElectronLDMainClient('client-side-id', {
    registerInMain: false,
    diagnosticOptOut: true,
    sendEvents: false,
    initialConnectionMode: 'polling',
  });
  await client.identify({ kind: 'user', key: 'bob' });

  const regex = /https:\/\/clientsdk\.launchdarkly\.com\/sdk\/evalx\/client-side-id\/contexts\/.*/;
  expect(mockedFetch).toHaveBeenCalledWith(expect.stringMatching(regex), expect.anything());
});

it('uses correct default streaming url', (done) => {
  const mockedCreateEventSource = jest.fn();
  (ElectronPlatform as jest.Mock).mockReturnValue({
    crypto: new ElectronCrypto(),
    info: new ElectronInfo(),
    requests: {
      createEventSource: mockedCreateEventSource,
      fetch: jest.fn(),
      getEventSourceCapabilities: jest.fn(),
    },
    encoding: new ElectronEncoding(),
    storage: {
      clear: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
    },
  });
  const client = new ElectronLDMainClient('client-side-id', {
    registerInMain: false,
    diagnosticOptOut: true,
    sendEvents: false,
    initialConnectionMode: 'streaming',
  });

  client
    .identify({ kind: 'user', key: 'bob' }, { timeout: 0 })
    .then(() => {})
    .catch(() => {})
    .then(() => {
      const regex = /https:\/\/clientstream\.launchdarkly\.com\/eval\/client-side-id\/.*/;
      expect(mockedCreateEventSource).toHaveBeenCalledWith(
        expect.stringMatching(regex),
        expect.anything(),
      );
      done();
    });
});

it('includes authorization header for polling', async () => {
  const mockedFetch = mockFetch('{"flagA": true}', 200);
  (ElectronPlatform as jest.Mock).mockReturnValue({
    crypto: new ElectronCrypto(),
    info: new ElectronInfo(),
    requests: {
      createEventSource: jest.fn(),
      fetch: mockedFetch,
      getEventSourceCapabilities: jest.fn(),
    },
    encoding: new ElectronEncoding(),
    storage: {
      clear: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
    },
  });
  const client = new ElectronLDMainClient('client-side-id', {
    registerInMain: false,
    diagnosticOptOut: true,
    sendEvents: false,
    initialConnectionMode: 'polling',
  });
  await client.identify({ kind: 'user', key: 'bob' });

  expect(mockedFetch).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      headers: expect.objectContaining({ authorization: 'client-side-id' }),
    }),
  );
});

it('includes authorization header for streaming', (done) => {
  const mockedCreateEventSource = jest.fn();
  (ElectronPlatform as jest.Mock).mockReturnValue({
    crypto: new ElectronCrypto(),
    info: new ElectronInfo(),
    requests: {
      createEventSource: mockedCreateEventSource,
      fetch: jest.fn(),
      getEventSourceCapabilities: jest.fn(),
    },
    encoding: new ElectronEncoding(),
    storage: {
      clear: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
    },
  });
  const client = new ElectronLDMainClient('client-side-id', {
    registerInMain: false,
    diagnosticOptOut: true,
    sendEvents: false,
    initialConnectionMode: 'streaming',
  });

  client
    .identify({ kind: 'user', key: 'bob' }, { timeout: 0 })
    .then(() => {})
    .catch(() => {})
    .then(() => {
      expect(mockedCreateEventSource).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          headers: expect.objectContaining({ authorization: 'client-side-id' }),
        }),
      );
      done();
    });
});

it('includes authorization header for events', async () => {
  const mockedFetch = mockFetch('{"flagA": true}', 200);
  (ElectronPlatform as jest.Mock).mockReturnValue({
    crypto: new ElectronCrypto(),
    info: new ElectronInfo(),
    requests: {
      createEventSource: jest.fn(),
      fetch: mockedFetch,
    },
    encoding: new ElectronEncoding(),
    storage: {
      clear: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
    },
  });
  const client = new ElectronLDMainClient('client-side-id', {
    registerInMain: false,
    diagnosticOptOut: true,
    initialConnectionMode: 'polling',
  });
  await client.identify({ kind: 'user', key: 'bob' });
  await client.flush();

  expect(mockedFetch).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      headers: expect.objectContaining({ authorization: 'client-side-id' }),
    }),
  );
});

it('identify with too high of a timeout', () => {
  const logger: LDLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
  const client = new ElectronLDMainClient('client-side-id', {
    registerInMain: false,
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
  const client = new ElectronLDMainClient('client-side-id', {
    registerInMain: false,
    sendEvents: false,
    initialConnectionMode: 'offline',
    logger,
  });
  client.identify({ key: 'potato', kind: 'user' }, { timeout: 15 });
  expect(logger.warn).not.toHaveBeenCalled();
});

it('can get connection mode', () => {
  const client = new ElectronLDMainClient('client-side-id', {
    registerInMain: false,
    diagnosticOptOut: true,
    initialConnectionMode: 'offline',
  });

  const mode = client.getConnectionMode();
  expect(mode).toEqual('offline');
});

it('can detect if offline', () => {
  const client = new ElectronLDMainClient('client-side-id', {
    registerInMain: false,
    diagnosticOptOut: true,
    initialConnectionMode: 'offline',
  });

  expect(client.isOffline()).toEqual(true);
});

it('can detect if not offline', () => {
  const client = new ElectronLDMainClient('client-side-id', {
    registerInMain: false,
    diagnosticOptOut: true,
    initialConnectionMode: 'streaming',
  });

  expect(client.isOffline()).toEqual(false);
});

it('can set connection mode to offline', async () => {
  const client = new ElectronLDMainClient('client-side-id', {
    registerInMain: false,
    diagnosticOptOut: true,
    initialConnectionMode: 'streaming',
  });

  const setEventSendingEnabled = jest.spyOn(client as any, 'setEventSendingEnabled');
  const setConnectionMode = jest.spyOn((client as any).dataManager, 'setConnectionMode');

  await client.setConnectionMode('offline');

  expect(setEventSendingEnabled).toHaveBeenCalledTimes(1);
  expect(setEventSendingEnabled).toHaveBeenNthCalledWith(1, false, true);

  expect(setConnectionMode).toHaveBeenCalledTimes(1);
  expect(setConnectionMode).toHaveBeenNthCalledWith(1, 'offline');
});

it('can set connection mode to not offline', async () => {
  const client = new ElectronLDMainClient('client-side-id', {
    registerInMain: false,
    diagnosticOptOut: true,
    initialConnectionMode: 'offline',
  });

  const setEventSendingEnabled = jest.spyOn(client as any, 'setEventSendingEnabled');
  const setConnectionMode = jest.spyOn((client as any).dataManager, 'setConnectionMode');

  await client.setConnectionMode('streaming');

  expect(setConnectionMode).toHaveBeenCalledTimes(1);
  expect(setConnectionMode).toHaveBeenNthCalledWith(1, 'streaming');

  expect(setEventSendingEnabled).toHaveBeenCalledTimes(1);
  expect(setEventSendingEnabled).toHaveBeenNthCalledWith(1, true, false);
});
