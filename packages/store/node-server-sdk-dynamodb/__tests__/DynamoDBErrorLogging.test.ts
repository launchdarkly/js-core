import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

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

it('logs at error level when getAll fails', async () => {
  const logger = makeLogger();
  const state = {
    prefixedKey: (key: string) => key,
    query: jest.fn().mockRejectedValue(new Error('query failed')),
  };
  // @ts-ignore Partial state mock for testing.
  const core = new DynamoDBCore('test-table', state, logger);

  const descriptors = await new Promise((resolve) => {
    core.getAll(featuresKind, resolve);
  });

  expect(descriptors).toBeUndefined();
  expect(logger.error).toHaveBeenCalledWith('Error reading features: Error: query failed');
});

it('logs through the wrapper when a real upsert fails', (done) => {
  const { PersistentDataStoreWrapper: RealWrapper } = jest.requireActual(
    '@launchdarkly/node-server-sdk',
  );
  const logger = makeLogger();
  const state = {
    prefixedKey: (key: string) => key,
    put: jest.fn().mockRejectedValue(new Error('write throttled')),
    close: jest.fn(),
  };
  // @ts-ignore Partial state mock for testing.
  const core = new DynamoDBCore('test-table', state, logger);
  const wrapper = new RealWrapper(core, 0, logger);

  wrapper.upsert(featuresKind, { key: 'flagA', version: 1 }, () => {
    expect(logger.error).toHaveBeenCalledWith('Persistent store returned error: write throttled');
    wrapper.close();
    done();
  });
});

// A stub client keeps the plumbing tests hermetic. No real AWS client is
// constructed, so no region or credential lookup happens.
function makeFakeDynamoDBClient() {
  // @ts-ignore Partial client mock for testing.
  return { send: jest.fn(), destroy: jest.fn() } as DynamoDBClient;
}

it('passes the SDK logger to the persistent store wrapper', () => {
  const logger = makeLogger();
  const store = new DynamoDBFeatureStore(
    'test-table',
    { dynamoDBClient: makeFakeDynamoDBClient() },
    logger,
  );

  expect(store).toBeDefined();
  const wrapperMock = PersistentDataStoreWrapper as unknown as jest.Mock;
  expect(wrapperMock).toHaveBeenCalledTimes(1);
  // The store wraps the logger, so verify the wrapper logger forwards to it.
  const wrapperLogger: LDLogger = wrapperMock.mock.calls[0][2];
  wrapperLogger.error('probe');
  expect(logger.error).toHaveBeenCalledWith('probe');
});

it('prefers the logger from the store options over the SDK logger', () => {
  const optionsLogger = makeLogger();
  const sdkLogger = makeLogger();
  const store = new DynamoDBFeatureStore(
    'test-table',
    { dynamoDBClient: makeFakeDynamoDBClient(), logger: optionsLogger },
    sdkLogger,
  );

  expect(store).toBeDefined();
  const wrapperMock = PersistentDataStoreWrapper as unknown as jest.Mock;
  expect(wrapperMock).toHaveBeenCalledTimes(1);
  const wrapperLogger: LDLogger = wrapperMock.mock.calls[0][2];
  wrapperLogger.error('probe');
  expect(optionsLogger.error).toHaveBeenCalledWith('probe');
  expect(sdkLogger.error).not.toHaveBeenCalled();
});
