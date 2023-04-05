/* eslint-disable */
import initLD from '@launchdarkly/cloudflare-server-sdk';

export interface Env {
  LD_KV: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const client = initLD(env.LD_KV, 'my-sdk-key');
    const context = { kind: 'user', key: 'test-user-key-1' };
    const flagValue = await client.variation('dev-test-flag', context, false);
    return new Response(`dev-test-flag: ${flagValue}`);
  },
};
