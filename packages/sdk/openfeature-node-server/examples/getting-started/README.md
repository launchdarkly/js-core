# LaunchDarkly sample OpenFeature provider application for Node.js

We've built a simple console application that demonstrates how to use the
LaunchDarkly OpenFeature provider for Node.js to evaluate flags through the
[OpenFeature](https://openfeature.dev/) interface.

Below, you'll find the build procedure. For more comprehensive instructions, you
can visit your [Quickstart page](https://app.launchdarkly.com/quickstart#/) or
the [Node.js (server-side) reference guide](https://docs.launchdarkly.com/sdk/server-side/node-js).

This demo requires Node.js 20 or higher.

## Build instructions

1. Set the environment variable `LAUNCHDARKLY_SDK_KEY` to your LaunchDarkly SDK
   key. If there is an existing boolean feature flag in your LaunchDarkly
   project that you want to evaluate, set `LAUNCHDARKLY_FLAG_KEY` to the flag
   key; otherwise, a boolean flag of `sample-feature` will be assumed.

    ```bash
    export LAUNCHDARKLY_SDK_KEY="my-sdk-key"
    export LAUNCHDARKLY_FLAG_KEY="my-boolean-flag"
    ```

2. From the example directory, install dependencies and run the example:

    ```bash
    yarn start
    ```

    You should receive the message:

    > The {flagKey} feature flag evaluates to {flagValue}.

The application will run continuously and react to flag changes in LaunchDarkly.
Toggle the flag in the LaunchDarkly dashboard to watch the demo re-evaluate live.
