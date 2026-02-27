# LaunchDarkly sample Electron application

We've built a simple Electron application that demonstrates how the LaunchDarkly Electron SDK works. The app uses a main/renderer process setup: the main process connects to LaunchDarkly and manages flag state; the renderer uses the same client via IPC to evaluate flags and listen for changes.

For more comprehensive instructions, see your [Quickstart page](https://app.launchdarkly.com/quickstart#/) or the [Electron SDK reference](https://docs.launchdarkly.com/sdk/client-side/electron).

This example was scaffolded with [Electron Forge](https://www.electronforge.io/)'s `create-electron-app` script (version 7.11.1) using the `--template=vite-typescript` flag.

## Prerequisites

- Node.js 16 or later
- Yarn

## Build instructions

1. Set the `LAUNCHDARKLY_MOBILE_KEY` environment variable to your LaunchDarkly mobile key.

2. If there is an existing boolean feature flag in your LaunchDarkly project you want to use, set the `LAUNCHDARKLY_FLAG_KEY` environment variable to that flag's key. If there is not an existing flag you can use, create a new boolean flag in your project and use that flag's key.

3. Run the app from the repository root:
   ```bash
   yarn workspace @internal/electron-example start
   ```

   Electron Forge will build and launch the app. The window shows the current value of the flag and updates in real time when you change it in LaunchDarkly.

## Project structure

- **`src/main.ts`** – Main process: initializes the LaunchDarkly client, identifies the user, and creates the window.
- **`src/renderer.ts`** – Renderer process: gets the client via the bridge, waits for initialization, then evaluates flags and listens for `change` events.
- **`src/preload.ts`** – Preload script: exposes the LaunchDarkly bridge to the renderer via `contextBridge`.

The mobile key is inlined into the renderer bundle at build time (see `vite.renderer.config.ts`) so that main and renderer use the same value for IPC channel names.
