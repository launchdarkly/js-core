import app from './index';
import testData from './testData.json';

test('variation true', async () => {
  // arrange
  const env = getMiniflareBindings();
  const { LD_KV } = env;
  await LD_KV.put('LD-Env-test-sdk-key', JSON.stringify(testData));

  // act
  const res = await app.fetch(new Request('http://localhost'), env);

  // assert
  expect(await res.text()).toContain('testFlag1: true');
});
