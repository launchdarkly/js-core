# LaunchDarkly sample React server-side application

We've built a simple web application that demonstrates how the LaunchDarkly React SDK works with
React Server Components (RSC). The app evaluates a feature flag on the server and renders the
result — no client-side JavaScript required.

The demo also shows 2 ways to use react server side rendering:

1. Using `createLDServerSession` and `useLDServerSession` to provide
per-request session isolation: every HTTP request creates its own `LDServerSession` bound to
that request's user context. Nested Server Components access the session through React's `cache()`
without any prop drilling.

2. Using the `LDIsomorphicProvider` to bootstrap the browser SDK with server-evaluated flag values. This
eliminates the client-side flag fetch waterfall — the browser SDK starts immediately with real
values.

Below, you'll find the build procedure. For more comprehensive instructions, you can visit your
[Quickstart page](https://app.launchdarkly.com/quickstart#/) or the
[React SDK reference guide](https://docs.launchdarkly.com/sdk/client-side/react/react-web).

This demo requires Node.js 18 or higher.

## How it works

| Module | Role |
|--------|------|
| `ldBaseClient` (module-level) | A singleton Node SDK client, initialized once per process. Shared across all requests. |
| `createLDServerSession(ldBaseClient, context)` | Called once per request in `app/page.tsx`. Binds the request context to the client and stores the session in React's `cache()`. |
| `useLDServerSession()` (in `App.tsx`) | Retrieves the session from React's per-request cache. No props needed — React isolates each request automatically. |
| `LDIsomorphicProvider` | Wraps the app to bootstrap the browser SDK with server-evaluated flags. |
| `BootstrapClient` (in `App.tsx`) | A `'use client'` component that logs the bootstrap data to the browser console. |

To observe per-request isolation, open browser tabs with different `context` query parameters.
Each tab gets a completely independent `LDServerSession` with its own context:

```
http://localhost:3000/?context=sandy
http://localhost:3000/?context=jamie
http://localhost:3000/?context=alex
```

In a production app, the user identity would come from auth tokens, cookies, or session data
instead of query parameters.

## Build instructions

1. Set the value of the `LAUNCHDARKLY_SDK_KEY` environment variable to your LaunchDarkly SDK key.

   ```bash
   export LAUNCHDARKLY_SDK_KEY="my-sdk-key"
   ```

2. Set the `LAUNCHDARKLY_CLIENT_SIDE_ID` environment variable to enable bootstrap.
   The server evaluates all flags and passes them to the browser SDK so flags are
   available immediately on the client without a network round-trip.

   ```bash
   export LAUNCHDARKLY_CLIENT_SIDE_ID="my-client-side-id"
   ```

3. If there is an existing boolean feature flag in your LaunchDarkly project that you want to
   evaluate, set `LAUNCHDARKLY_FLAG_KEY`:

   ```bash
   export LAUNCHDARKLY_FLAG_KEY="my-flag-key"
   ```

   Otherwise, `sample-feature` will be used by default.

4. On the command line, run:

   ```bash
   yarn dev
   ```

   Then open [http://localhost:3000](http://localhost:3000) in your browser. You will see the
   spec message, current context name, and a full-page background: green when the
   flag is on, or grey when off.

5. To simulate a different user, append the `?context=` query parameter:

   | URL | Context |
   |-----|---------|
   | `http://localhost:3000/` | Sandy (example-user-key) — default |
   | `http://localhost:3000/?context=sandy` | Sandy (example-user-key) |
   | `http://localhost:3000/?context=jamie` | Jamie (user-jamie) |
   | `http://localhost:3000/?context=alex` | Alex (user-alex) |

   If you have targeting rules in LaunchDarkly that serve different values to different user keys,
   you will see different flag results for each context.
