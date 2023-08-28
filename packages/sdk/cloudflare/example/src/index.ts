import { init as initLD } from '@launchdarkly/cloudflare-server-sdk';

export default {
  async fetch(request: Request, env: Bindings): Promise<Response> {
    const clientSideID = '59b2b2596d1a250b1c78baa4';
    const flagKey = 'dev-test-flag';
    const context = { kind: 'org', key: 'org-key-cf', email: 'testcforg@gmail.com' };

    // start using ld
    const client = initLD(clientSideID, env.LD_KV, { sendEvents: true });
    await client.waitForInitialization();
    const flagValue = await client.variation(flagKey, context, false);
    const flagDetail = await client.variationDetail(flagKey, context, false);
    const allFlags = await client.allFlagsState(context);
    await client.flush((err, res) => {
      console.log(`============ flushed events result: ${res}. error: ${err}`);
    });

    const resp = `
    ${flagKey}: ${flagValue}
    detail: ${JSON.stringify(flagDetail)}
    allFlags: ${JSON.stringify(allFlags)}`;

    // eslint-disable-next-line
    console.log(`------------- ${resp}`);
    return new Response(`${resp}`);
  },
};
