# LaunchDarkly sample Shopify Oxygen application

We've built a simple console application that demonstrates how this LaunchDarkly SDK works.

Below, you'll find the build procedure. For more comprehensive instructions, you can visit your [Quickstart page](https://app.launchdarkly.com/quickstart#/).
<!-- NOTE: no official docs in LD website yet
or the [{name of SDK} reference guide](https://docs.launchdarkly.com/sdk/{path to the page for that SDK}).
-->

This demo requires `Node >= 22.0.0` and `yarn@^3.4.1`

## Build instructions

1. Edit [`src/index.ts`](src/index.ts) and set the value of `sdkKey` to your LaunchDarkly SDK key.
    ```
    const sdkKey = "1234567890abcdef";
    ```

2. If there is an existing boolean feature flag in your LaunchDarkly project that
   you want to evaluate, set `flagKey` to the flag key:
    ```
    const flagKey = "my-flag-key";
    ```
    > Otherwise, `sample-feature` will be used by default.

3. On the command line, run `yarn start`, You should receive the message:
    ```
    The {flagKey} feature flag evaluates to {flagValue}.
    ```
The application will run continuously and react to the flag changes in LaunchDarkly.