import { BasicLogger } from '@launchdarkly/js-server-sdk-common';

import { EdgeFeatureStore } from '../../src/featureStore';
import { LDOptionsInternal, validateOptions } from '../../src/utils/validateOptions';

const SDK_KEY = 'test-key';

const mockProvider = jest.fn().mockImplementation(() => ({
  get: 'test',
}));

const edgeProvider = mockProvider({ namespace: 'test', group: 'test' });

const mockOptions = ({
  featureStore,
  logger,
  additional,
  allowEmptyFS,
  allowEmptyLogger,
}: {
  featureStore?: EdgeFeatureStore;
  logger?: BasicLogger;
  additional?: any;
  allowEmptyFS?: boolean;
  allowEmptyLogger?: boolean;
}) => {
  const mockLogger = logger ?? BasicLogger.get();
  const mockFeatureStore =
    featureStore ?? new EdgeFeatureStore(edgeProvider, SDK_KEY, 'validationTest', mockLogger);

  return {
    featureStore: allowEmptyFS ? undefined : mockFeatureStore,
    logger: allowEmptyLogger ? undefined : mockLogger,
    ...additional,
  } as LDOptionsInternal;
};

const expectError = (callback: Function, expectedError: Error) => {
  expect.assertions(1);
  try {
    callback();
  } catch (error) {
    expect(error).toEqual(expectedError);
  }
};

describe('Validate options', () => {
  it('Invalid configuaration provided', () => {
    const options = mockOptions({ additional: { extra: 'unsupported property' } });
    const errorResponse = new Error('Invalid configuration: extra not supported');
    expectError(() => validateOptions(SDK_KEY, options), errorResponse);
  });

  describe('sdkkey', () => {
    it('valid sdk key is provided', () => {
      const response = validateOptions(SDK_KEY, mockOptions({}));
      expect(response).toBe(true);
    });

    it('no sdk key is provided', () => {
      const errorResponse = new Error('You must configure the client with a client key');
      expectError(() => validateOptions('', mockOptions({})), errorResponse);
    });
  });

  describe('featureStore', () => {
    it('no feature store provided ', () => {
      const options = mockOptions({ allowEmptyFS: true });
      const errorResponse = new Error('You must configure the client with a feature store');
      expectError(() => validateOptions(SDK_KEY, options), errorResponse);
    });
  });

  describe('logger', () => {
    it('no logger provided', () => {
      const options = mockOptions({ allowEmptyLogger: true });
      const errorResponse = new Error('You must configure the client with a logger');
      expectError(() => validateOptions(SDK_KEY, options), errorResponse);
    });
  });
});
