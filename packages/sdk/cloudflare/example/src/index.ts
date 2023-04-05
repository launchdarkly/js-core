/* eslint-disable */
import initLD from '@launchdarkly/cloudflare-server-sdk';

export interface Env {
  LD_KV: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // test data
    const sdkKey = '555abcde';
    const flagKey = 'dev-test-flag';
    const context = { kind: 'user', key: 'test-user-key-1' };

    // start using ld
    const client = initLD(env.LD_KV, sdkKey);
    await client.waitForInitialization();
    const flag = await client.variation(flagKey, context, false);
    const flagDetail = await client.variationDetail(flagKey, context, false);
    const allFlags = await client.allFlagsState(context);
    return new Response(
      `${flagKey}: ${flag}, detail: ${JSON.stringify(flagDetail)}, allFlags: ${JSON.stringify(
        allFlags
      )}`
    );
  },
};
