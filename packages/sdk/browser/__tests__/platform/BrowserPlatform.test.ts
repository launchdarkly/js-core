import {
  EventSourceInitDict,
  LDEventSourceFactory,
  LDLogger,
  Storage,
} from '@launchdarkly/js-client-sdk-common';

import BrowserPlatform from '../../src/platform/BrowserPlatform';
import LocalStorage, { isLocalStorageSupported } from '../../src/platform/LocalStorage';

jest.mock('../../src/platform/LocalStorage', () => {
  const actual = jest.requireActual('../../src/platform/LocalStorage');
  return {
    __esModule: true,
    default: jest.fn(),
    isLocalStorageSupported: jest.fn(() => true),
    getAllStorageKeys: actual.getAllStorageKeys,
  };
});

const mockLocalStorage = LocalStorage as jest.MockedClass<typeof LocalStorage>;
const mockIsSupported = isLocalStorageSupported as jest.MockedFunction<
  typeof isLocalStorageSupported
>;

let logger: LDLogger;

beforeEach(() => {
  jest.clearAllMocks();
  mockIsSupported.mockReturnValue(true);
  logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
});

function makeCustomStorage(): Storage {
  return { get: jest.fn(), set: jest.fn(), clear: jest.fn() };
}

it('uses the provided storage override and does not construct LocalStorage', () => {
  const custom = makeCustomStorage();
  const platform = new BrowserPlatform(logger, {}, custom);

  expect(platform.storage).toBe(custom);
  expect(mockLocalStorage).not.toHaveBeenCalled();
});

it('falls back to LocalStorage when no override is provided and localStorage is supported', () => {
  const platform = new BrowserPlatform(logger, {});

  expect(mockLocalStorage).toHaveBeenCalledTimes(1);
  expect(platform.storage).toBe(mockLocalStorage.mock.instances[0]);
});

it('has no storage when no override is provided and localStorage is unsupported', () => {
  mockIsSupported.mockReturnValue(false);

  const platform = new BrowserPlatform(logger, {});

  expect(platform.storage).toBeUndefined();
  expect(mockLocalStorage).not.toHaveBeenCalled();
});

it('uses the provided storage override even when localStorage is unsupported', () => {
  mockIsSupported.mockReturnValue(false);
  const custom = makeCustomStorage();

  const platform = new BrowserPlatform(logger, {}, custom);

  expect(platform.storage).toBe(custom);
  expect(mockLocalStorage).not.toHaveBeenCalled();
});

it('reports no optional event source capabilities when no factory override is provided', () => {
  const platform = new BrowserPlatform(logger, {});

  expect(platform.requests.getEventSourceCapabilities()).toEqual({
    customMethod: false,
    readTimeout: false,
    headers: false,
  });
});

it('uses the provided event source factory override', () => {
  const created = { close: jest.fn() };
  const factory: LDEventSourceFactory = {
    createEventSource: jest.fn().mockReturnValue(created),
    capabilities: { customMethod: true, readTimeout: true, headers: true },
  };

  const platform = new BrowserPlatform(logger, {}, undefined, factory);
  const initDict: EventSourceInitDict = {
    headers: { authorization: 'sdk-key' },
    errorFilter: () => true,
    initialRetryDelayMillis: 1000,
    readTimeoutMillis: 300000,
    retryResetIntervalMillis: 60000,
  };

  expect(platform.requests.createEventSource('http://example.com/stream', initDict)).toBe(created);
  expect(factory.createEventSource).toHaveBeenCalledWith('http://example.com/stream', initDict);
  expect(platform.requests.getEventSourceCapabilities()).toEqual({
    customMethod: true,
    readTimeout: true,
    headers: true,
  });
});
