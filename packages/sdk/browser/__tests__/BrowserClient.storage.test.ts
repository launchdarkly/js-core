import { AutoEnvAttributes, LDLogger } from '@launchdarkly/js-client-sdk-common';

import { makeClient } from '../src/BrowserClient';

const mockPlatformConstructor = jest.fn();

jest.mock('../src/platform/BrowserPlatform', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation((logger, options, storage) => {
    mockPlatformConstructor(logger, options, storage);
    // eslint-disable-next-line global-require
    const { makeBasicPlatform } = require('./BrowserClient.mocks');
    const platform = makeBasicPlatform(options);
    // Surface the storage the client wired in so we can assert on it, while
    // keeping a working mock platform for the rest of construction.
    if (storage) {
      platform.storage = storage;
    }
    return platform;
  }),
}));

let logger: LDLogger;

beforeEach(() => {
  jest.clearAllMocks();
  logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
});

function getWiredStorage() {
  return mockPlatformConstructor.mock.calls[0][2];
}

it('wraps and passes a custom storage through to the platform', async () => {
  const myStorage = {
    get: jest.fn(async () => 'cached'),
    set: jest.fn(async () => {}),
    clear: jest.fn(async () => {}),
  };

  makeClient(
    'client-side-id',
    { key: 'user-key', kind: 'user' },
    AutoEnvAttributes.Disabled,
    { streaming: false, logger, diagnosticOptOut: true, storage: myStorage },
  );

  const wired = getWiredStorage();
  expect(wired).toBeDefined();

  // The wired storage delegates to the user's implementation.
  await expect(wired.get('k')).resolves.toEqual('cached');
  await wired.set('k', 'v');
  await wired.clear('k');
  expect(myStorage.get).toHaveBeenCalledWith('k');
  expect(myStorage.set).toHaveBeenCalledWith('k', 'v');
  expect(myStorage.clear).toHaveBeenCalledWith('k');
  expect(logger.warn).not.toHaveBeenCalled();
});

it('does not pass a storage override when none is configured', () => {
  makeClient(
    'client-side-id',
    { key: 'user-key', kind: 'user' },
    AutoEnvAttributes.Disabled,
    { streaming: false, logger, diagnosticOptOut: true },
  );

  expect(getWiredStorage()).toBeUndefined();
});

it('does not let a throwing custom storage escape the wrapper', async () => {
  const throwingStorage = {
    get: jest.fn(async () => {
      throw new Error('boom');
    }),
    set: jest.fn(async () => {
      throw new Error('boom');
    }),
    clear: jest.fn(async () => {
      throw new Error('boom');
    }),
  };

  makeClient(
    'client-side-id',
    { key: 'user-key', kind: 'user' },
    AutoEnvAttributes.Disabled,
    { streaming: false, logger, diagnosticOptOut: true, storage: throwingStorage },
  );

  const wired = getWiredStorage();
  await expect(wired.get('k')).resolves.toBeNull();
  await expect(wired.set('k', 'v')).resolves.toBeUndefined();
  await expect(wired.clear('k')).resolves.toBeUndefined();
  expect(logger.error).toHaveBeenCalledTimes(3);
});
