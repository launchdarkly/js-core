/* eslint-disable no-console */
import { init as initLD } from '@launchdarkly/cloudflare-server-sdk';

export default {
  async fetch(request: Request, env: Bindings, ctx: ExecutionContext): Promise<Response> {
    const sdkKey = 'test-sdk-key';
    const flagKey = 'testFlag1';
    const { searchParams } = new URL(request.url);

    // falsemail will return false, other emails return true
    const email = searchParams.get('email') ?? 'test@anymail.com';
    const context = { kind: 'user', key: 'test-user-key-1', email };

    // start using ld
    const client = initLD(sdkKey, env.LD_KV, { sendEvents: true });
    await client.waitForInitialization();
    const flagValue = await client.variation(flagKey, context, false);
    const flagDetail = await client.variationDetail(flagKey, context, false);
    const allFlags = await client.allFlagsState(context);

    const resp = `
    ${flagKey}: ${flagValue}
    detail: ${JSON.stringify(flagDetail)}
    allFlags: ${JSON.stringify(allFlags)}`;

    console.log(`------------- ${resp}`);

    // Gotcha: you must call flush otherwise events will not be sent to LD servers
    // due to the ephemeral nature of edge workers.
    // https://developers.cloudflare.com/workers/runtime-apis/fetch-event/#waituntil
    ctx.waitUntil(
      client.flush((err: Error | null, res: boolean) => {
        console.log(`flushed events result: ${res}, error: ${err}`);
        client.close();
      }),
    );

    return new Response(`${resp}`);
  },
};
