import { OpenFeature } from '@openfeature/server-sdk';

import { LaunchDarklyProvider } from '@launchdarkly/openfeature-cloudflare-server';

// Set clientSideID to your client-side ID. This placeholder matches what the
// test suite seeds into local KV, so the example runs out of the box; swap it
// for your real client-side ID before real use.
const clientSideID = 'test-client-side-id';

// Set flagKey to the feature flag key you want to evaluate.
const flagKey = 'sample-feature';

// This context should appear on your LaunchDarkly contexts dashboard shortly after you run the demo.
const context = {
  kind: 'user',
  targetingKey: 'example-user-key',
  name: 'Sandy',
};

// LaunchDarkly's dark mode toggle colors: off for false, on for true.
const toggleOffColor = '#373841';
const toggleOnColor = '#00844B';

// OpenFeature.setProviderAndWait registers the provider on a global registry shared by
// every concurrent request in this isolate. Calling it per request would race concurrent
// invocations against each other, including each other's cleanup. Initialize once per
// isolate instead and reuse the client for every subsequent request, per
// https://github.com/launchdarkly/js-core/tree/main/packages/sdk/cloudflare#usage
// ("Applications should instantiate a single instance for the lifetime of the worker").
// The check-then-set below has no `await` between the check and the assignment, so it
// can't race even under concurrent requests, since Workers runs a single-threaded event loop.
let provider: LaunchDarklyProvider | undefined;
let providerReady: Promise<unknown> | undefined;

function ensureProviderReady(env: Bindings): Promise<unknown> {
  if (!providerReady) {
    provider = new LaunchDarklyProvider(clientSideID, env.LD_KV);
    providerReady = OpenFeature.setProviderAndWait(provider);
  }
  return providerReady;
}

export default {
  async fetch(request: Request, env: Bindings, ctx: ExecutionContext): Promise<Response> {
    await ensureProviderReady(env);

    const client = OpenFeature.getClient();
    const flagValue = await client.getBooleanValue(flagKey, false, context);

    const message = `The ${flagKey} feature flag evaluates to ${flagValue}.`;
    const background = flagValue ? toggleOnColor : toggleOffColor;

    // Gotcha: flush on every request, or events queued here never reach LD's servers once
    // this isolate recycles. Unlike provider registration above, flushing is scoped to
    // this request only, so it's safe to call every time. Must flush inside waitUntil:
    // without it, the Response below can return and tear down the Worker before an
    // unflushed event batch finishes sending.
    // https://developers.cloudflare.com/workers/runtime-apis/fetch-event/#waituntil
    ctx.waitUntil(
      provider!.getClient().flush((err: Error | null, res: boolean) => {
        console.log(`flushed events result: ${res}, error: ${err}`);
      }),
    );

    // The worker renders the page itself, so the flag value is styled inline.
    // Both interpolations are safe to inline unescaped: flagKey is developer-supplied
    // source code, not runtime input, and flagValue is a boolean.
    const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>LaunchDarkly OpenFeature Cloudflare example</title>
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
