# LaunchDarkly sample browser extension

We've built a simple Chrome Manifest V3 extension that runs the JavaScript Browser SDK in the
extension's background service worker.

Below, you'll find the build procedure. For more comprehensive instructions, you can visit your [Quickstart page](https://app.launchdarkly.com/quickstart#/) or
the [JavaScript SDK reference guide](https://docs.launchdarkly.com/sdk/client-side/javascript).

## What it demonstrates

The background service worker ([`src/background.ts`](./src/background.ts)) owns the only
LaunchDarkly client in the extension. The other parts of the extension get flag values from it
with `chrome.runtime` messages:

- The popup ([`popup.html`](./popup.html), [`src/popup/popup.ts`](./src/popup/popup.ts)) shows
  the flag value.
- The content script ([`src/content-script.ts`](./src/content-script.ts)) runs on each page and
  logs the flag value to the page console.

While the service worker runs, the stream delivers flag changes to it. The worker then sends the
new value to the open popup and to every tab. Each time the worker starts, it also sends the
value one time, so a content script can log the same value two times. See
[Service worker lifecycle](#service-worker-lifecycle).

## Service worker configuration

A Manifest V3 service worker has no `window`, no `document` and no `localStorage`. The example
sets these options for that environment:

| Option        | Value                          | Why                                                                                                                                                                                                           |
| ------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `eventSource` | `fetchBrowserEventSource`      | A `fetch()`-based streaming transport. Unlike the native `EventSource`, it can send request headers, it can use `REPORT` or `POST`, it reports HTTP error statuses to the SDK, and it applies a read timeout. |
| `streaming`   | `true`                         | Keeps the streaming connection open, so flag changes arrive in real time.                                                                                                                                     |
| `storage`     | `chrome.storage.local` adapter | `localStorage` does not exist in a service worker. The adapter ([`src/storage/chromeStorageAdapter.ts`](./src/storage/chromeStorageAdapter.ts)) caches the context and flag values in `chrome.storage.local`. |
| `fetchGoals`  | `false`                        | Goals need a `document`.                                                                                                                                                                                      |

`fetchBrowserEventSource` comes from the `@launchdarkly/js-client-sdk/fetch-eventsource` entry
point. Only an application that imports this entry point gets it in its bundle. Its dependency,
`@launchdarkly/eventsource`, is an optional dependency of the SDK. If your install omits
optional dependencies, install it directly.

## Service worker lifecycle

Chrome stops an extension service worker when it is idle, and the stream closes with it. Chrome
starts the worker again for the next event, for example when the popup opens or a content script
sends a message. The worker then creates a new client, which first loads the cached flag values
from `chrome.storage.local` and then opens a new stream. Flag changes that occur while the worker
is stopped arrive when the worker starts again.

## Prerequisites

Nodejs 22 or later

## Build instructions

1. Make a copy of the `.env.template` and name it `.env`

   ```
   cp .env.template .env
   ```

2. Set the variables in `.env` to your specific LD values

   ```
   # Set LAUNCHDARKLY_CLIENT_SIDE_ID to your LaunchDarkly client-side ID
   LAUNCHDARKLY_CLIENT_SIDE_ID=

   # Set LAUNCHDARKLY_FLAG_KEY to the feature flag key you want to evaluate
   LAUNCHDARKLY_FLAG_KEY=
   ```

   > [!NOTE]
   > Setting these values is equivalent to modifying the `clientSideID` and `flagKey`
   > in [background.ts](./src/background.ts).

3. Install and build the project. This example uses the workspace build of
   `@launchdarkly/js-client-sdk`, so from the repository root build the SDK and its
   dependencies first, then the example:

   ```bash
   yarn workspaces foreach -pR --topological-dev --from '@launchdarkly/js-client-sdk' run build
   yarn workspace @launchdarkly/js-client-sdk-example-browser-extension build
   ```

4. Load the extension in Chrome:
   1. Open `chrome://extensions`.
   2. Turn on **Developer mode**.
   3. Click **Load unpacked** and select this directory
      (`packages/sdk/browser/examples/browser-extension`).

Click the extension icon on the toolbar to open the popup and see the flag value. To see the
service worker logs, click **service worker** on the extension card in `chrome://extensions`. To
see the content script logs, open the devtools console on any web page.
