# LaunchDarkly Browser SDK in an MV3 extension (POC)

This is a proof-of-concept Chrome MV3 extension whose **background service worker**
runs `@launchdarkly/js-client-sdk`.

## What it does

- Background service worker (`src/background.ts`) creates an LD client and evaluates a flag.
- Flag/context data is persisted with a `chrome.storage.local`-backed `LDStorage`
  adapter (`src/storage/chromeStorageAdapter.ts`), because `localStorage` does not
  exist in a service worker.
- The client starts eagerly at service-worker load, and a `client.on('change', ...)`
  listener logs flag updates detected by the SDK's own built-in poller -- no
  `chrome.alarms`-forced re-poll is used.
- The popup (`popup.html` + `src/popup/popup.ts`) asks the background worker for the
  current flag value via `chrome.runtime.sendMessage` and forwards it to the active
  tab's content script via `chrome.tabs.sendMessage`.
- The content script (`src/content-script.ts`) logs the propagated value.

## Required SDK configuration

The client **MUST** be created with these options to run in a service worker:

| Option | Value | Why |
| --- | --- | --- |
| `streaming` | `false` | `EventSource` does not exist in a service worker. Streaming is the one hard blocker; polling is the only viable update path. |
| `fetchGoals` | `false` | Goals/experimentation needs `document.querySelectorAll`, unavailable in a service worker. |
| `automaticBackgroundHandling` | `false` | Avoids registering `window` visibility/focus listeners that do not apply to a service-worker lifecycle. |
| `storage` | `chrome.storage.local` adapter | `localStorage` is unavailable; a custom `LDStorage` (shipped in SDK-2427) is required to persist the context/flag cache. |

## Build and load

Prerequisite: Node 20.6.0+ and `yarn`.

1. Copy the env template and fill in your values:
   ```bash
   cp .env.template .env
   # LAUNCHDARKLY_CLIENT_SIDE_ID=your-client-side-id
   # LAUNCHDARKLY_FLAG_KEY=your-flag-key
   ```
2. From the repo root, install and build:
   ```bash
   yarn
   yarn workspace @launchdarkly/browser-extension-example build
   ```
3. In Chrome, open `chrome://extensions`, enable **Developer mode**, click
   **Load unpacked**, and select this directory
   (`packages/sdk/browser/examples/frameworks/browser-extension`).

After loading the extension, you can see activity in the extension dev console.
There is also a simple popup that reports whether the designated flag is `true` or
`false` if you click on the extension icon on the toolbar.

