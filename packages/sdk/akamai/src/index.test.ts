import init from './index';

describe('init', () => {
  test('hello world', async () => {
    const response = init();
    expect(response).toEqual('Hello World');
  });
});
