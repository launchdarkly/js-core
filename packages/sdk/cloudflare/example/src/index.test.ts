import app from './index';
import mockFlags from './mockFlags.json';

test('variation true', async () => {
  // arrange
  const env = getMiniflareBindings();
  const { LD_KV } = env;
  await LD_KV.put('LD-Env-555abcde', JSON.stringify(mockFlags));

  // act
  const res = await app.fetch(new Request('http://localhost'), env);

  // assert
  expect(await res.text()).toContain('dev-test-flag: true');
  // expect(res.headers.get('Location')).toBe('http://localhost/test/increment');
});
