# LaunchDarkly React SDK — Hello LaunchDarkly

This is a minimal React application that demonstrates the LaunchDarkly React SDK. It evaluates a feature flag and displays the result, updating in real time without a browser refresh when the flag value changes.

## Requirements

- Node.js (v18 or later)
- yarn

## Setup

1. **Set your LaunchDarkly client-side ID**

   ```sh
   export LAUNCHDARKLY_CLIENT_SIDE_ID=your-client-side-id-here
   ```

   Or prefix the start command:

   ```sh
   LAUNCHDARKLY_CLIENT_SIDE_ID=your-client-side-id-here yarn start
   ```

2. **Create a feature flag**

   In your LaunchDarkly project, create a boolean feature flag with the key `sample-feature`. Make sure **client-side SDK access** is enabled for this flag.

   To use a different flag key, update `FLAG_KEY` in `src/App.tsx`.

3. **Install dependencies and start the app**

   ```sh
   yarn && yarn start
   ```

## Expected output

Once the app loads, you should see:

> SDK successfully initialized!
> The sample-feature feature flag evaluates to false.

The header background will be **dark gray** (`#373841`) when the flag is `false` and **green** (`#00844B`) when it is `true`.

Toggle the flag in your LaunchDarkly dashboard and the UI will update automatically — no browser refresh required.

## Context switching

Use the **Sandy**, **Jamie**, and **Alex** buttons to switch between preset evaluation contexts. The app calls `identify()` and re-evaluates the flag for the selected context. The default context on first load is Sandy (`example-user-key`).
