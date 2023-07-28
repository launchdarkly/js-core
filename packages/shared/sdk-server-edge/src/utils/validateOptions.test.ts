import { BasicLogger } from '@launchdarkly/js-server-sdk-common';

import mockFeatureStore from './mockFeatureStore';
import validateOptions from './validateOptions';

describe('validateOptions', () => {
  test('throws without SDK key', () => {
    expect(() => {
      validateOptions('', {});
    }).toThrowError(/You must configure the client with a client key/);
  });

  test('throws without featureStore', () => {
    expect(() => {
      validateOptions('test-sdk-key', {});
    }).toThrowError(/You must configure the client with a feature store/);
  });

  test('throws without logger', () => {
    expect(() => {
      validateOptions('test-sdk-key', { featureStore: mockFeatureStore });
    }).toThrowError(/You must configure the client with a logger/);
  });

  test('success valid options', () => {
    expect(
      validateOptions('test-sdk-key', {
        featureStore: mockFeatureStore,
        logger: BasicLogger.get(),
        sendEvents: false,
      }),
    ).toBeTruthy();
  });

  test('throws with invalid options', () => {
    expect(() => {
      validateOptions('test-sdk-key', {
        featureStore: mockFeatureStore,
        logger: BasicLogger.get(),
        // @ts-ignore
        streamUri: 'invalid-option',
        proxyOptions: 'another-invalid-option',
      });
    }).toThrowError(/Invalid configuration: streamUri,proxyOptions not supported/);
  });
});
