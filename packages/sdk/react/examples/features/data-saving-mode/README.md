# LaunchDarkly React SDK FDv2 example

A minimal [Vite](https://vitejs.dev/) + React app that exercises the React SDK's
FDv2 **data saving mode** (`dataSystem`) configuration.

> [!NOTE]
> Data saving mode is a LaunchDarkly Early Access Program (EAP) feature. The
> `dataSystem` option and its behaviors are not stable and may change before
> General Availability.

## What it demonstrates

- Enabling the FDv2 data system through the provider's `ldOptions`
  (`dataSystem: {}`), in [`src/LDClient.tsx`](./src/LDClient.tsx).
- Evaluating a flag with `useBoolVariation`, which updates live as the data
  system delivers changes.
- Switching the connection mode at runtime (`streaming`, `polling`, `offline`,
  `one-shot`, `background`, or automatic) via `useLDClient().setConnectionMode`.
- Toggling streaming via `setStreaming`.
- Switching the evaluation context via `identify`.

## Run it

This example uses the workspace build of `@launchdarkly/react-sdk`. From the
repository root, build the SDK and its dependencies first:

```bash
yarn workspaces foreach -pR --topological-dev --from '@launchdarkly/react-sdk' run build
```

Then start the example with your client-side ID (and optionally a flag key):

```bash
LAUNCHDARKLY_CLIENT_SIDE_ID=your-client-side-id \
LAUNCHDARKLY_FLAG_KEY=your-flag-key \
yarn workspace @launchdarkly/react-sdk-example-data-saving-mode start
```

Open the URL Vite prints (default <http://localhost:5173>).
