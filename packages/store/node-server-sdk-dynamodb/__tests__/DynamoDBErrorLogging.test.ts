import { interfaces, LDLogger, PersistentDataStoreWrapper } from '@launchdarkly/node-server-sdk';

import DynamoDBCore from '../src/DynamoDBCore';
import DynamoDBFeatureStore from '../src/DynamoDBFeatureStore';

jest.mock('@launchdarkly/node-server-sdk', () => {
  const actual = jest.requireActual('@launchdarkly/node-server-sdk');
  return {
    ...actual,
    PersistentDataStoreWrapper: jest.fn(),
  };
});

const featuresKind: interfaces.PersistentStoreDataKind = {
  namespace: 'features',
  deserialize: (data: string) => JSON.parse(data),
};

function makeLogger(): LDLogger {
  return {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

it('logs at error level when getAll fails', (done) => {
  const logger = makeLogger();
  const state = {
    prefixedKey: (key: string) => key,
    query: jest.fn().mockRejectedValue(new Error('query failed')),
  };
  // @ts-ignore Partial state mock for testing.
  const core = new DynamoDBCore('test-table', state, logger);

  core.getAll(featuresKind, (descriptors) => {
    expect(descriptors).toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith('Error reading features: Error: query failed');
    done();
  });
});

it('passes the SDK logger to the persistent store wrapper', () => {
  const logger = makeLogger();
  const store = new DynamoDBFeatureStore('test-table', undefined, logger);

  expect(store).toBeDefined();
  const wrapperMock = PersistentDataStoreWrapper as unknown as jest.Mock;
  expect(wrapperMock).toHaveBeenCalledTimes(1);
  expect(wrapperMock.mock.calls[0][2]).toBe(logger);
});

it('prefers the logger from the store options over the SDK logger', () => {
  const optionsLogger = makeLogger();
  const sdkLogger = makeLogger();
  const store = new DynamoDBFeatureStore('test-table', { logger: optionsLogger }, sdkLogger);

  expect(store).toBeDefined();
  const wrapperMock = PersistentDataStoreWrapper as unknown as jest.Mock;
  expect(wrapperMock).toHaveBeenCalledTimes(1);
  expect(wrapperMock.mock.calls[0][2]).toBe(optionsLogger);
});
