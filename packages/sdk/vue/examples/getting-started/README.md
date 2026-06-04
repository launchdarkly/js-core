# LaunchDarkly sample Vue application

We've built a simple Vue application that demonstrates how the LaunchDarkly Vue SDK works.

Below, you'll find the build procedure. For more comprehensive instructions, you can visit your [Quickstart page](https://app.launchdarkly.com/quickstart#/) or the [Vue SDK reference guide](https://docs.launchdarkly.com/sdk/client-side/vue).

This demo requires Node.js v18 or later.

## Build instructions

1. Set the value of the `LAUNCHDARKLY_CLIENT_SIDE_ID` environment variable to your client-side ID. You can copy `.env.example` to `.env` and fill it in:

   ```bash
   cp .env.example .env
   ```

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

   You should see the message:
   > "The sample-feature feature flag evaluates to false."

The application will run continuously and react to flag changes in LaunchDarkly: the background turns green (#00844B) when the flag evaluates to true and dark gray (#373841) when it evaluates to false.
