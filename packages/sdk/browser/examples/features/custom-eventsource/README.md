# LaunchDarkly Browser SDK custom EventSource example

A minimal vanilla-TypeScript app that demonstrates the Browser SDK's injectable
`eventSource` option.

## What it demonstrates

The Browser SDK defaults to the native browser `EventSource` API for its streaming
connection. That API has no way to send a custom HTTP method or a request body, so setting
`usePost: true` alone throws, because the FDv2 data source requires an EventSource that
can send a custom method.

This example passes `fetchBrowserEventSource` (from
`@launchdarkly/js-client-sdk/fetch-eventsource`) as the `eventSource` option, in
[`src/app.ts`](./src/app.ts). That option opts into a `fetch()`-based EventSource
implementation which _can_ send a POST request with a body, which is what lets
`usePost` actually take effect. Open your browser's devtools Network tab while running
this example and look for a `POST` request to the streaming endpoint, instead of the
`GET`-based request the default transport would make.

This example also enables the FDv2 data system (`dataSystem: {}`). `usePost` only applies
to FDv2's streaming synchronizer -- the FDv1 data source uses `useReport` instead, which
this example does not set.

`fetchBrowserEventSource` lives behind its own entry point specifically so that neither it
nor its dependency (`@launchdarkly/eventsource`) ends up in the SDK's default bundle --
only an application that imports this path pays for it.

## Prerequisites

Nodejs 20.6.0 or later

## Build instructions

1. From the repository root, build the SDK and its dependencies first:

   ```bash
   yarn workspaces foreach -pR --topological-dev --from '@launchdarkly/js-client-sdk' run build
   ```

2. Make a copy of the `.env.template` and name it `.env`

   ```
   cp .env.template .env
   ```

3. Set the variables in `.env` to your specific LD values

   ```
   # Set LAUNCHDARKLY_CLIENT_SIDE_ID to your LaunchDarkly client-side ID
   LAUNCHDARKLY_CLIENT_SIDE_ID=

   # Set LAUNCHDARKLY_FLAG_KEY to the feature flag key you want to evaluate
   LAUNCHDARKLY_FLAG_KEY=
   ```

   > [!NOTE]
   > Setting these values is equivalent to modifying the `clientSideID` and `flagKey`
   > in [app.ts](./src/app.ts).

4. Install and build the example:

   ```bash
   yarn workspace @launchdarkly/browser-example-custom-eventsource build
   ```

5. Run the example:
   ```bash
   yarn workspace @launchdarkly/browser-example-custom-eventsource start
   ```
   > [!NOTE]
   > The `start` script simply runs `open index.html`. If that is not working for you, you
   > can open the `index.html` file in a browser for the same results.

The application will run continuously and react to flag changes in LaunchDarkly, streaming
over the fetch-based EventSource the whole time.
