import { init as initLD } from '@launchdarkly/cloudflare-server-sdk';

// Set clientSideID to your client-side ID. This placeholder matches what the
// test suite seeds into local KV, so the example runs out of the box; swap it
// for your real client-side ID before real use.
const clientSideID = 'test-client-side-id';

// Set flagKey to the feature flag key you want to evaluate.
const flagKey = 'sample-feature';

// This context should appear on your LaunchDarkly contexts dashboard shortly after you run the demo.
const context = {
  kind: 'user',
  key: 'example-user-key',
  name: 'Sandy',
};

// LaunchDarkly's dark mode toggle colors: off for false, on for true.
const toggleOffColor = '#373841';
const toggleOnColor = '#00844B';

export default {
  async fetch(request: Request, env: Bindings, ctx: ExecutionContext): Promise<Response> {
    // sendEvents defaults to false in edge SDKs; it's on here to demonstrate
    // the flush gotcha below.
    const client = initLD(clientSideID, env.LD_KV, { sendEvents: true });
    await client.waitForInitialization({ timeout: 10 });
    const flagValue = await client.boolVariation(flagKey, context, false);

    const message = `The ${flagKey} feature flag evaluates to ${flagValue}.`;
    const background = flagValue ? toggleOnColor : toggleOffColor;

    // Must flush inside waitUntil: without it, the Response below can return and
    // tear down the Worker before an unflushed event batch finishes sending.
    // https://developers.cloudflare.com/workers/runtime-apis/fetch-event/#waituntil
    ctx.waitUntil(
      client.flush((err: Error | null, res: boolean) => {
        console.log(`flushed events result: ${res}, error: ${err}`);
        client.close();
      }),
    );

    // The worker renders the page itself, so the flag value is styled inline.
    // Both interpolations are safe to inline unescaped: flagKey is developer-supplied
    // source code, not runtime input, and flagValue is a boolean.
    const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>LaunchDarkly Cloudflare example</title>
  </head>
  <body style="margin: 0; background: ${background}; font-family: sans-serif; text-align: center">
    <p id="flag-value" style="color: #FFFFFF">${message}</p>
  </body>
</html>
`;

    return new Response(html, {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  },
};
