# LaunchDarkly sample OpenFeature Cloudflare Workers application

We've built a simple Cloudflare Worker that demonstrates how the LaunchDarkly OpenFeature
provider for Cloudflare Workers (`@launchdarkly/openfeature-cloudflare-server`) works.

Below, you'll find the build procedure. For more comprehensive instructions, you can visit your [Quickstart page](https://app.launchdarkly.com/quickstart#/) or the [Cloudflare SDK reference guide](https://docs.launchdarkly.com/sdk/server-side/cloudflare).

This demo requires Node 22 or higher and yarn. It also requires the Wrangler CLI (v3, installed as a dev dependency of this example). The steps below run entirely against Wrangler's local simulated storage, so a Cloudflare account and login are not required to follow them; they're only needed if you want to seed the real remote preview KV namespace or run `yarn deploy`. See the [wrangler docs](https://developers.cloudflare.com/workers/wrangler/commands/#login) on how to log in to your Cloudflare account if you do need that.

The underlying Cloudflare SDK reads flag data from a Cloudflare KV namespace rather than connecting to LaunchDarkly to fetch flags; this example configures the provider to send analytics events to LaunchDarkly in the background (see the flush comment in [src/index.ts](./src/index.ts)). The steps below seed a local KV namespace with the sample flag data in [src/testData.json](./src/testData.json), so you can run the example without configuring the integration first.

## Build instructions

1. [src/index.ts](./src/index.ts) ships with `clientSideID` hardcoded to a placeholder value:

   ```ts
   const clientSideID = 'test-client-side-id';
   ```

   This placeholder matches the key the steps below seed in local KV (and what the test suite
   uses), so you can follow this walkthrough without editing it. For actual use, replace it with
   your real client-side ID:

   ```ts
   const clientSideID = 'my-client-side-id';
   ```

   If you do this, remember to also seed local KV under the new key in step 5 below, and to
   revert the edit (or not commit it) before running
   `yarn workspace @launchdarkly/hello-openfeature-cloudflare-server test`, since the test suite
   expects the placeholder value.

2. If there is an existing boolean feature flag in your LaunchDarkly project that you want to evaluate, set `flagKey` in [src/index.ts](./src/index.ts) to the flag key:

   ```ts
   const flagKey = 'my-flag-key';
   ```

   Otherwise, `sample-feature` will be used by default.

   Note that the local seed data in [src/testData.json](./src/testData.json) only contains the
   `sample-feature` flag. If you point `flagKey` at your own flag key, you'll see
   `evaluates to false` in the response, but the SDK will log
   `Unknown feature flag "<your-key>"; returning default value` to the console explaining why -
   you'll need real KV data (from the LaunchDarkly Cloudflare integration) for that flag to
   evaluate correctly.

3. Build the SDK and this example. At the root of the js-core repo:

   ```bash
   yarn && yarn build
   ```

4. The placeholder `YOUR_KV_ID` and `YOUR_PREVIEW_KV_ID` values in [wrangler.toml](./wrangler.toml) work fine as-is for the local walkthrough below; `wrangler dev` and `wrangler kv` with `--local` operate against Wrangler's local simulated storage regardless of what the configured namespace ID looks like. You only need to replace them with your own Cloudflare KV namespace IDs if you want to deploy this worker or seed the real remote preview KV namespace:

   ```toml
   kv_namespaces = [{ binding = "LD_KV", id = "YOUR_KV_ID", preview_id = "YOUR_PREVIEW_KV_ID" }]
   ```

5. Seed the local KV namespace with the sample flag data. The key must be your client-side ID prefixed with `LD-Env-`; the Cloudflare SDK uses that prefix to distinguish LaunchDarkly data from other data in the namespace. In the example below the client-side ID is the `test-client-side-id` placeholder that ships in [src/index.ts](./src/index.ts).

   `yarn start` (`wrangler dev`) runs entirely against Wrangler's local simulated storage by default, so the `--local` flag below is required for the seeded data to be visible to the running example. Without `--local`, the data is written to the actual remote preview KV namespace instead, which the default (local) `wrangler dev` mode used in this README does not read.

   ```bash
   npx wrangler kv key put --binding=LD_KV "LD-Env-test-client-side-id" --path ./src/testData.json --preview --local
   ```

   (substitute your own client-side ID for `test-client-side-id` here if you set one in step 1)

6. View that data to confirm it is present:

   ```bash
   npx wrangler kv key get --binding=LD_KV "LD-Env-test-client-side-id" --preview --local
   ```

7. On the command line, run the worker:

   ```bash
   yarn start
   ```

   Then open the URL that `wrangler dev` prints (`http://localhost:8787` by default). The page shows the message:

   > The sample-feature feature flag evaluates to true.

   in white text on a green (`#00844B`) background, because the flag evaluates to `true`. If it evaluated to `false`, the background would be dark grey (`#373841`).

   If you're using a placeholder or otherwise non-real client-side ID, the `wrangler dev` console will show an event-flush error line, something like `flushed events result: false, error: ...404...`. This is expected and does not mean the flag evaluation demo failed; only event delivery to LaunchDarkly is affected.

Because a Cloudflare Worker only runs while it is handling a request, each request performs one flag evaluation. Update the flag data in KV and send another request to see the new value.

## Running the tests

The test is an end-to-end test: it loads the running worker in a headless browser. The first time you run it, install that browser:

```bash
yarn workspace @launchdarkly/hello-openfeature-cloudflare-server playwright install chromium
```

Then:

```bash
yarn workspace @launchdarkly/hello-openfeature-cloudflare-server test
```

That command builds the worker, seeds the local KV namespace with [src/testData.json](./src/testData.json) under the `clientSideID` constant hardcoded in [src/index.ts](./src/index.ts) (the same command as step 5 above, also available on its own as `yarn seed-kv`), and then hands off to [Playwright](https://playwright.dev/), which starts `wrangler dev` for you, opens `http://localhost:8787` in headless Chromium, and asserts the rendered page reports `feature flag evaluates to true` in white text on the green background.

If you already have `yarn start` running, Playwright reuses it instead of starting a second server.
