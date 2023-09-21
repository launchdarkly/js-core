import app from './index';
import testData from './testData.json';

describe('test', () => {
  let env: Bindings;

  beforeEach(async () => {
    env = getMiniflareBindings();
    const { LD_KV } = env;
    await LD_KV.put('LD-Env-test-sdk-key', JSON.stringify(testData));
  });

  test('variation true', async () => {
    const res = await app.fetch(new Request('http://localhost/?email=truemail'), env);
    expect(await res.text()).toContain('testFlag1: true');
  });

  test('variation false', async () => {
    const res = await app.fetch(new Request('http://localhost/?email=falsemail'), env);
    expect(await res.text()).toContain('testFlag1: false');
  });
});
