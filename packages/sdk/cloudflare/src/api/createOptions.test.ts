import createOptions from './createOptions';
import mockKV from '../utils/mockKV';

describe('createOptions', () => {
  it('throws without SDK key', () => {
    expect(() => {
      createOptions(mockKV, '');
    }).toThrowError(/You must configure the client with a client key/);
  });
});
