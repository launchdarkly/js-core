/* eslint-disable no-console */
import { init as initLD } from '@launchdarkly/cloudflare-server-sdk';

// handler types ripped from the cloudflare docs:
// https://developers.cloudflare.com/workers/examples/accessing-the-cloudflare-object/
const handler: ExportedHandler<Bindings> = {
  async fetch(
    request: Request,
    env: Bindings,
    executionContext: ExecutionContext,
  ): Promise<Response> {
    const clientSideID = 'client-side-id';
    const flagKey = 'testFlag1';
    const { searchParams } = new URL(request.url);

    // falsemail will return false, other emails return true
    const email = searchParams.get('email') ?? 'test@anymail.com';
    const context = { kind: 'user', key: 'test-user-key-1', email };

    // start using ld
    const client = initLD(clientSideID, env.LD_KV, { sendEvents: true });
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
    executionContext.waitUntil(
      client.flush((err, res) => {
        console.log(`flushed events result: ${res}, error: ${err}`);
      }),
    );

    return new Response(`${resp}`);
  },
};

export default handler;
