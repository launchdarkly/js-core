import validateOptions from './validateOptions';
import mockFeatureStore from './mockFeatureStore';

describe('validateOptions', () => {
  it('throws without SDK key', () => {
    expect(() => {
      validateOptions('', {});
    }).toThrowError(/You must configure the client with a client key/);
  });

  it('throws without featureStore', () => {
    expect(() => {
      validateOptions('test-sdk-key', {});
    }).toThrowError(/You must configure the client with a feature store/);
  });

  it('throws without logger', () => {
    expect(() => {
      validateOptions('test-sdk-key', { featureStore: mockFeatureStore });
    }).toThrowError(/You must configure the client with a logger/);
  });
});
