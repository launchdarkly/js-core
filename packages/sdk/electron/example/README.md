# LaunchDarkly sample Electron application

# ⛔️⛔️⛔️⛔️

> [!CAUTION]
> This example is created against a non-production SDK which means things may change and this example might
> not work while this message is visible.

# ☝️☝️☝️☝️☝️☝️

We've built a simple Electron application that demonstrates how the LaunchDarkly Electron SDK works. The app uses a main/renderer process setup: the main process connects to LaunchDarkly and manages flag state; the renderer uses the same client via IPC to evaluate flags and listen for changes.

For more comprehensive instructions, see your [Quickstart page](https://app.launchdarkly.com/quickstart#/) or the [Client-side Electron reference guide](https://docs.launchdarkly.com/sdk/client-side/electron).
> [!CAUTION]
> These links are out of date and do not reflect the current state of the SDK. We will update these links once the new Electron SDK is stable.

This example was scaffolded with [Electron Forge](https://www.electronforge.io/)'s `create-electron-app` script (version 7.11.1) using the `--template=vite-typescript` flag.

## Prerequisites

- Node.js 16 or later
- Yarn

## Build and run

1. **Install dependencies** from the repository root:
   ```bash
   yarn
   ```

2. **Set your LaunchDarkly mobile key** (optional but required for real flag evaluation):
   - Set the `LD_MOBILE_KEY` environment variable to your LaunchDarkly mobile key from your [LaunchDarkly project](https://app.launchdarkly.com).
   - If unset, the app uses a placeholder and will not connect to a real LaunchDarkly environment.
   - The same value is used at **build time** for the renderer and at **runtime** for the main process, so set it before both building and starting:
   ```bash
   export LD_MOBILE_KEY=your-mobile-key-here
   ```
   - For legacy client-side ID usage, set `LD_CLIENT_SIDE_ID` and pass `useClientSideId: true` in options to `initInMain`.

3. **Start the example** from the repository root:
   ```bash
   yarn workspace @internal/electron-example start
   ```
   Or from this directory:
   ```bash
   yarn start
   ```

   Electron Forge will build and launch the app. The window shows the current value of the `sample-feature` flag and updates when you change it in LaunchDarkly.

## Project structure

- **`src/main.ts`** – Main process: initializes the LaunchDarkly client, identifies the user, and creates the window.
- **`src/renderer.ts`** – Renderer process: gets the client via the bridge, waits for initialization, then evaluates flags and listens for `change` events.
- **`src/preload.ts`** – Preload script: exposes the LaunchDarkly bridge to the renderer via `contextBridge`.

The SDK key (mobile key or client-side ID when using `useClientSideId: true`) is inlined into the renderer bundle at build time (see `vite.renderer.config.ts`) so that main and renderer use the same value for IPC channel names.
