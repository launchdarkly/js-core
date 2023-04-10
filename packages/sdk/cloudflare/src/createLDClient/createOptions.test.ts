import createOptions from './createOptions';

describe('createOptions', () => {
  it('throws without SDK key', () => {
    expect(() => {
      // @ts-ignore
      createOptions({}, '');
    }).toThrowError(/You must configure the client with a client key/);
  });
});
