/* eslint-disable no-console */
import { init as initLD } from '@launchdarkly/cloudflare-server-sdk';

export default {
  async fetch(request: Request, env: Bindings): Promise<Response> {
    const clientSideID = 'client-side-id';
    const flagKey = 'testFlag1';
    const context = { kind: 'org', key: 'org-key-cf', email: 'testcforg@gmail.com' };

    // start using ld
    const client = initLD(clientSideID, env.LD_KV, { sendEvents: true });
    await client.waitForInitialization();
    const flagValue = await client.variation(flagKey, context, false);
    const flagDetail = await client.variationDetail(flagKey, context, false);
    const allFlags = await client.allFlagsState(context);

    // Gotcha: you must call flush otherwise events will not be sent to LD servers
    // due to the ephemeral nature of edge workers.
    await client.flush((err, res) => {
      console.log(`flushed events result: ${res}, error: ${err}`);
    });

    const resp = `
    ${flagKey}: ${flagValue}
    detail: ${JSON.stringify(flagDetail)}
    allFlags: ${JSON.stringify(allFlags)}`;

    console.log(`------------- ${resp}`);
    return new Response(`${resp}`);
  },
};
