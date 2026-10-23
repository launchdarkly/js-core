import req from './req.cjs';

let client;
export default {
  async fetch(_req, env) {
    client ??= req.init('test-client-side-id', env.LD_KV, { sendEvents: false });
    await client.waitForInitialization({ timeout: 5 });
    const value = await client.boolVariation('sample-feature', { kind: 'user', key: 'u1' }, false);
    return Response.json({ entry: 'cjs-require', exportCount: req.keys, value });
  },
};
