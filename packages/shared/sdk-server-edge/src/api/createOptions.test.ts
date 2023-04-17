import createOptions from './createOptions';
import mockFeatureStore from '../utils/mockFeatureStore';

describe('createOptions', () => {
  it('throws without SDK key', () => {
    expect(() => {
      createOptions('', mockFeatureStore);
    }).toThrowError(/You must configure the client with a client key/);
  });
});
