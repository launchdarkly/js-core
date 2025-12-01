# LaunchDarkly sample javascript application

# ⛔️⛔️⛔️⛔️

> [!CAUTION]
> This example is created against a non-production SDK which means things may change and this example might
> not work while this message is visible.

# ☝️☝️☝️☝️☝️☝️

We've built a simple browser application that demonstrates how this LaunchDarkly SDK works.

Below, you'll find the build procedure. For more comprehensive instructions, you can visit your [Quickstart page](https://app.launchdarkly.com/quickstart#/) or
the [{name of SDK} reference guide](https://docs.launchdarkly.com/sdk/client-side/javascript).

## Build instructions

Modify [app.ts](./src/app.ts) with the following changes:

1. Set the value of the {`clientSideID`} variable in {file name} to your client-side ID:
    ```typescript
    const clientSideID = "my-client-side-id";
    ```
   
2. If there is an existing boolean feature flag in your LaunchDarkly project that
   you want to evaluate, set `flagKey` to the flag key:
    ```typescript
    const flagKey = "my-flag-key";
    ```

3. If you haven't already, install and build the project:
    ```bash
    yarn && yarn build
    ```

4. On the command line, run `yarn start`
    ```bash
    yarn start
    ```
    > [!NOTE]
    > The `yarn start` script simply runs `open index.html`. If that is not working for you,
    > you can open the `index.html` file in a browser for the same results.

The application will run continuously and react to the flag changes in LaunchDarkly.