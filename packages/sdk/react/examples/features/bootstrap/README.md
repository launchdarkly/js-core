# LaunchDarkly sample React application with bootstrap

We've built a simple Vite + React application that demonstrates how to seed the LaunchDarkly
React SDK with `bootstrap` data so the first paint reflects evaluated flag values without
waiting for the initial flag fetch.

Below, you'll find the build procedure. For more comprehensive instructions, you can visit your
[Quickstart page](https://app.launchdarkly.com/quickstart#/) or the
[React SDK reference guide](https://docs.launchdarkly.com/sdk/client-side/react/react-web).

This demo requires Node.js v20 or later.

## What this example adds on top of [`hello-react`](../../hello-react/)

* A small Express server (`server/index.ts`) initializes `@launchdarkly/node-server-sdk`,
  evaluates the client-side flags for the example context with
  `allFlagsState(context, { clientSideOnly: true })`, and exposes the result at
  `GET /api/bootstrap`.
* `src/index.tsx` `await`s that endpoint before mounting the app and passes the response to
  `LDReactProviderOptions.bootstrap`:

  ```ts
  const bootstrap = await fetchBootstrap();
  const LDReactProvider = createLDReactProvider(clientSideId, context, { bootstrap });
  ```

  With `bootstrap` set, the React SDK returns the seeded values from `useBoolVariation` (and the
  other variation hooks) on the very first render -- no flag-fetch waterfall, no flicker between
  the default and the evaluated value.

## Build instructions

1. Set `LAUNCHDARKLY_SDK_KEY` to your server-side SDK key (used by the Express server) and
   `LAUNCHDARKLY_CLIENT_SIDE_ID` to your client-side ID (read at build time by Vite):

   ```bash
   export LAUNCHDARKLY_SDK_KEY="my-server-side-sdk-key"
   export LAUNCHDARKLY_CLIENT_SIDE_ID="my-client-side-id"
   ```

   Alternatively, copy `.env.example` to `.env` and set them there.

2. If there is an existing boolean feature flag in your LaunchDarkly project that you want to
   evaluate, set `LAUNCHDARKLY_FLAG_KEY` to the flag key:

   ```bash
   export LAUNCHDARKLY_FLAG_KEY="my-flag-key"
   ```

   Otherwise, `sample-feature` will be used by default.

3. On the command line, run:

   ```bash
   yarn && yarn start
   ```

   Then open [http://localhost:3001](http://localhost:3001). The page renders the bootstrapped
   flag value immediately; you should not see an "initializing" flash.
