# LaunchDarkly sample React application

We've built a simple React application that demonstrates how the LaunchDarkly React SDK works.

Below, you'll find the build procedure. For more comprehensive instructions, you can visit your [Quickstart page](https://app.launchdarkly.com/quickstart#/) or the [React SDK reference guide](https://docs.launchdarkly.com/sdk/client-side/react/react-web).

This demo requires Node.js v18 or later.

## Build instructions

1. Copy `.env.example` to `.env` and fill in your LaunchDarkly client-side ID:

   ```bash
   cp .env.example .env
   ```

   Then edit `.env`:

   ```
   LAUNCHDARKLY_CLIENT_SIDE_ID=my-client-side-id
   ```

   Alternatively, export the variable directly:

   ```bash
   export LAUNCHDARKLY_CLIENT_SIDE_ID="my-client-side-id"
   ```

2. If there is an existing boolean feature flag in your LaunchDarkly project that you want to evaluate, set `LAUNCHDARKLY_FLAG_KEY` to the flag key:

   ```bash
   export LAUNCHDARKLY_FLAG_KEY="my-flag-key"
   ```

   Otherwise, `sample-feature` will be used by default.

3. Install dependencies and start the app:

   ```bash
   yarn && yarn start
   ```

   You should receive the message:
   > "The sample-feature feature flag evaluates to false."

The application will run continuously and react to the flag changes in LaunchDarkly.
