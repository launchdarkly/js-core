import createOptions from './createOptions';
import mockEdge from '../utils/mockEdge';

describe('createOptions', () => {
  it('throws without SDK key', () => {
    expect(() => {
      createOptions(mockEdge, '');
    }).toThrowError(/You must configure the client with a client key/);
  });
});
