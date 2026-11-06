# LaunchDarkly JavaScript Browser SDK FDv2 example

A minimal browser app that exercises the Browser SDK's FDv2 **data saving mode**
(`dataSystem`) configuration.

> [!NOTE]
> Data saving mode is a LaunchDarkly Early Access Program (EAP) feature. The
> `dataSystem` option and its behaviors are not stable and may change before
> General Availability.

## What it demonstrates

- Enabling the FDv2 data system with `dataSystem: {}` in the `createClient`
  options, in [`src/app.ts`](./src/app.ts).
- Evaluating a flag with `variation`, which updates live once you switch the
  connection mode to `streaming` or `polling` (the browser default, `one-shot`,
  fetches once at page load and does not update afterward).
- Switching the connection mode at runtime (`streaming`, `polling`, `offline`,
  `one-shot`, `background`, or automatic) via `setConnectionMode`.
- Toggling streaming via `setStreaming`.
- Switching the evaluation context via `identify`.
- Registering and unregistering `change` and `error` event handlers.

## Prerequisites

Nodejs 22 or later

## Run it

1. Make a copy of the `.env.template` and name it `.env`, then set
   `LAUNCHDARKLY_CLIENT_SIDE_ID` and (optionally) `LAUNCHDARKLY_FLAG_KEY`:

   ```bash
   cp .env.template .env
   ```

   > [!NOTE]
   > Setting these values is equivalent to modifying the `clientSideID` and `flagKey`
   > in [app.ts](./src/app.ts). The flag key defaults to `sample-feature`.

2. This example uses the workspace build of `@launchdarkly/js-client-sdk`. From the
   repository root, build the SDK and its dependencies first, then the example:

   ```bash
   yarn workspaces foreach -pR --topological-dev --from '@launchdarkly/js-client-sdk' run build
   yarn workspace @launchdarkly/js-client-sdk-example-data-saving-mode build
   ```

3. Start the example:

   ```bash
   yarn workspace @launchdarkly/js-client-sdk-example-data-saving-mode start
   ```

   > [!NOTE]
   > The `start` script simply runs `open index.html`. If that is not working for you,
   > you can open the `index.html` file in a browser for the same results.
