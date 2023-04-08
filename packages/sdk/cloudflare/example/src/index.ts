/* eslint-disable */
import initLD from '@launchdarkly/cloudflare-server-sdk';

export default {
  async fetch(request: Request, env: Bindings, ctx?: ExecutionContext): Promise<Response> {
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
    const resp = `${flagKey}: ${flag}, detail: ${JSON.stringify(
      flagDetail
    )}, allFlags: ${JSON.stringify(allFlags)}`;
    console.log(`------------- ${resp}`);
    return new Response(resp);
  },
};
