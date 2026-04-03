# LaunchDarkly sample React + Vercel Edge application

We've built a simple web application that demonstrates how the LaunchDarkly React SDK works with
the Vercel Edge SDK. The app evaluates feature flags using data stored in
[Vercel Edge Config](https://vercel.com/docs/edge-config/overview) and renders the result using
React Server Components.

The Vercel SDK reads flag data from Edge Config instead of connecting to LaunchDarkly servers
directly, providing ultra-low latency flag evaluation at the edge.

The demo shows 2 ways to use React server-side rendering:

1. Using `createLDServerSession` and `useLDServerSession` to provide
per-request session isolation: Nested Server Components access the session through React's `cache()`
without any prop drilling.

2. Using the `LDIsomorphicProvider` to bootstrap the browser SDK with server-evaluated flag values.
This allows the browser SDK to start immediately with real values.

Below, you'll find the build procedure. For more comprehensive instructions, you can visit your
[Quickstart page](https://app.launchdarkly.com/quickstart#/) or the
[React SDK reference guide](https://docs.launchdarkly.com/sdk/client-side/react/react-web).

This demo requires Node.js 18 or higher.

## Prerequisites

This example requires the [LaunchDarkly Vercel integration](https://vercel.com/integrations/launchdarkly)
to be configured. The integration syncs your LaunchDarkly flag data to Vercel Edge Config so that
the Vercel SDK can read it without connecting to LaunchDarkly servers.

## Build instructions

1. Set the `VERCEL_EDGE_CONFIG` environment variable to your Vercel Edge Config connection string.
   You can find this in your Vercel project settings under Edge Config.

   ```bash
   export VERCEL_EDGE_CONFIG="https://edge-config.vercel.com/ecfg_..."
   ```

2. Set the `LD_CLIENT_SIDE_ID` environment variable to your LaunchDarkly client-side ID.
   The Vercel SDK uses this to look up flag data in Edge Config, and the same value is used
   to bootstrap the browser SDK.

   ```bash
   export LD_CLIENT_SIDE_ID="my-client-side-id"
   ```

3. If there is an existing boolean feature flag in your LaunchDarkly project that you want to
   evaluate, set `LAUNCHDARKLY_FLAG_KEY`:

   ```bash
   export LAUNCHDARKLY_FLAG_KEY="my-flag-key"
   ```

   Otherwise, `sample-feature` will be used by default.

## Running

On the command line, run:

```bash
yarn dev
```

Then open [http://localhost:3000](http://localhost:3000) in your browser. You will see the
spec message, current context name, and a full-page background: green when the flag is on,
or grey when off.

To simulate a different user, append the `?context=` query parameter. Each tab gets a
completely independent `LDServerSession` with its own context:

| URL | Context |
|-----|---------|
| `http://localhost:3000/` | Sandy (example-user-key) — default |
| `http://localhost:3000/?context=sandy` | Sandy (example-user-key) |
| `http://localhost:3000/?context=jamie` | Jamie (user-jamie) |
| `http://localhost:3000/?context=alex` | Alex (user-alex) |

If you have targeting rules in LaunchDarkly that serve different values to different user keys,
you will see different flag results for each context.

In a production app, the user identity would come from auth tokens, cookies, or session data
instead of query parameters.
