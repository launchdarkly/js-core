import { init as initLD } from '@launchdarkly/cloudflare-server-sdk';

// Set clientSideID to your client-side ID. This placeholder value matches the
// key the test suite seeds in local KV, so leaving it as-is lets the example
// run out of the box; replace it with your real client-side ID for actual use.
const clientSideID = 'test-client-side-id';

// Set flagKey to the feature flag key you want to evaluate.
const flagKey = 'sample-feature';

// This context should appear on your LaunchDarkly contexts dashboard shortly after you run the demo.
const context = {
  kind: 'user',
  key: 'example-user-key',
  name: 'Sandy',
};

const asciiArt = `
        ██       
          ██     
      ████████   
         ███████ 
██ LAUNCHDARKLY █
         ███████ 
      ████████   
          ██     
        ██       
`;

export default {
  async fetch(request: Request, env: Bindings, ctx: ExecutionContext): Promise<Response> {
    // sendEvents is on (opting out of the edge-SDK exemption) to demonstrate
    // the flush gotcha below.
    const client = initLD(clientSideID, env.LD_KV, { sendEvents: true });
    await client.waitForInitialization({ timeout: 10 });
    const flagValue = await client.boolVariation(flagKey, context, false);

    const message = `The ${flagKey} feature flag evaluates to ${flagValue}.`;
    const output = flagValue ? `${message}\n${asciiArt}` : message;
    console.log(output);

    // Must flush inside waitUntil: the Response below can return and tear down
    // the Worker before an unflushed event batch would otherwise finish sending.
    // https://developers.cloudflare.com/workers/runtime-apis/fetch-event/#waituntil
    ctx.waitUntil(
      client.flush((err: Error | null, res: boolean) => {
        console.log(`flushed events result: ${res}, error: ${err}`);
        client.close();
      }),
    );

    return new Response(output);
  },
};
