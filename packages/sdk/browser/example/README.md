# LaunchDarkly sample javascript application

# ⛔️⛔️⛔️⛔️

> [!CAUTION]
> This example is created against a non-production SDK which means things may change and this example might
> not work while this message is visible.

# ☝️☝️☝️☝️☝️☝️

We've built a simple browser application that demonstrates how this LaunchDarkly SDK works.

Below, you'll find the build procedure. For more comprehensive instructions, you can visit your [Quickstart page](https://app.launchdarkly.com/quickstart#/) or
the [{name of SDK} reference guide](https://docs.launchdarkly.com/sdk/client-side/javascript).

## Prerequisites

Nodejs 20.6.0 or later

## Build instructions

1. Make a copy of the `.env.template` and name it `.env`
    ```
    cp .env.template .env
    ```

2. Set the variables in `.env` to your specific LD values
    ```
    # Set LD_CLIENT_SIDE_ID to your LaunchDarkly client-side ID
    LD_CLIENT_SIDE_ID=

    # Set LD_FLAG_KEY to the feature flag key you want to evaluate
    LD_FLAG_KEY=
    ```
    > [!NOTE]
    > Setting these values is equivilent to modifying the `clientSideID` and `flagKey`
    > in [app.ts](./src/app.ts).

3. Install and build the project:
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
