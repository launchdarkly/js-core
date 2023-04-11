// import app from './index';
// import mockFlags from './mockFlags.json';
//
// test('variation true', async () => {
//   // arrange
//   const env = getMiniflareBindings();
//   const { LD_KV } = env;
//   await LD_KV.put('LD-Env-555abcde', JSON.stringify(mockFlags));
//
//   // act
//   const res = await app.fetch(new Request('http://localhost'), env);
//
//   // assert
//   expect(await res.text()).toContain('dev-test-flag: true');
// });

import { Miniflare } from 'miniflare';

const mf = new Miniflare({
  modules: true,
  script: `
  export default {
    async fetch(request, env, ctx) {
      const value = parseInt(await env.TEST_NAMESPACE.get("count")) + 1;
      await env.TEST_NAMESPACE.put("count", value.toString());
      return new Response(value.toString());
    },
  }
  `,
  // TODO: use this mockWorker instead of inline script above
  // scriptPath: 'src/utils/mockWorker.ts',
  kvNamespaces: ['TEST_NAMESPACE'],
});

describe('worker', () => {
  test('variation', async () => {
    const ns = await mf.getKVNamespace('TEST_NAMESPACE');
    await ns.put('count', '1');

    const res = await mf.dispatchFetch('http://localhost:8787/');
    expect(await res.text()).toEqual('2');
    expect(await ns.get('count')).toEqual('2');
  });
});
