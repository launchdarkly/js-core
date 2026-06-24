# LaunchDarkly sample Node.js (client-side) application

We've built a simple console application that demonstrates how LaunchDarkly's Client-Side SDK for Node.js works.

Below, you'll find the build procedure. For more comprehensive instructions, you can visit your [Quickstart page](https://app.launchdarkly.com/quickstart#/) or the [Node.js (client-side) SDK reference guide](https://docs.launchdarkly.com/sdk/client-side/node-js).

This demo requires Node.js 18 or higher.

## Build instructions

1. Set the value of the `clientSideId` variable in `src/index.ts` to your client-side ID:

    ```ts
    const clientSideId = 'my-client-side-id';
    ```

    Alternatively, set the `LAUNCHDARKLY_CLIENT_SIDE_ID` environment variable:

    ```bash
    export LAUNCHDARKLY_CLIENT_SIDE_ID="my-client-side-id"
    ```

2. If there is an existing boolean feature flag in your LaunchDarkly project that you want to evaluate, set `flagKey` to the flag key:

    ```ts
    const flagKey = 'my-flag-key';
    ```

    Otherwise, `sample-feature` will be used by default.

3. From the repository root, install dependencies, build the SDK, and run the example:

    ```bash
    yarn install
    yarn workspaces foreach -pR --topological-dev --from '@launchdarkly/node-client-sdk' run build
    yarn workspace hello-node-client start
    ```

    You should receive the message:

    > *** The 'sample-feature' feature flag evaluates to `<flagValue>`.

The application will run continuously and react to flag changes in LaunchDarkly. To run it once and exit (e.g. in CI), set the `CI` environment variable to any value.
