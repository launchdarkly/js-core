import { createClient, type LDContext } from '@launchdarkly/js-client-sdk';
import { fetchBrowserEventSource } from '@launchdarkly/js-client-sdk/fetch-eventsource';

import type { FlagValueMessage, GetFlagMessage } from './messages';
import { createChromeStorageAdapter } from './storage/chromeStorageAdapter';

// Set clientSideID to your LaunchDarkly client-side ID
const clientSideID = 'LD_CLIENT_SIDE_ID';

// Set flagKey to the feature flag key you want to evaluate
const flagKey = 'LD_FLAG_KEY';

// Set up the evaluation context. This context should appear on your
// LaunchDarkly contexts dashboard soon after you run the demo.
const context: LDContext = {
  kind: 'user',
  key: 'example-user-key',
  name: 'Sandy',
};

// A Manifest V3 service worker has fetch(), but it has no EventSource and no localStorage.
// - eventSource: fetchBrowserEventSource streams flag updates over fetch(). The default
//   transport is the native EventSource, which does not exist in a service worker.
// - storage keeps the cached context and flag values in chrome.storage.local.
// - fetchGoals: false turns off goals, because goals need a document.
const client = createClient(clientSideID, context, {
  eventSource: fetchBrowserEventSource,
  streaming: true,
  fetchGoals: false,
  storage: createChromeStorageAdapter(),
});

function flagValueMessage(): FlagValueMessage {
  const value = client.variation(flagKey, false);
  // Chrome can stop the worker before the next scheduled flush, and the queued events are then
  // lost. Send the evaluation event now.
  client.flush();
  return { type: 'FLAG_VALUE', flagKey, value };
}

// Chrome can stop the service worker when it is idle and start it again for the next event.
// This code runs again on each start. The SDK first loads the cached flag values from storage
// and then opens a new stream.
const started = client.start({ timeout: 5 }).then(({ status }) => {
  // eslint-disable-next-line no-console
  console.log(`[LaunchDarkly] initialization status: ${status}`);
});

function broadcast(message: FlagValueMessage): void {
  // The popup gets this message only when it is open. If no extension page listens, the
  // promise rejects, and that is not an error here.
  chrome.runtime.sendMessage(message).catch(() => {});

  // A tab that has no content script also rejects the message. Examples are chrome:// pages and
  // tabs that were open before the extension was installed.
  chrome.tabs.query({}).then((tabs) => {
    tabs.forEach((tab) => {
      if (tab.id !== undefined) {
        chrome.tabs.sendMessage(tab.id, message).catch(() => {});
      }
    });
  });
}

// The stream delivers flag updates while the service worker runs. Send the new value to all
// listeners, so that they do not have to ask again.
client.on('change', (_context: LDContext, changedKeys: string[]) => {
  if (changedKeys.includes(flagKey)) {
    broadcast(flagValueMessage());
  }
});

// Register listeners at the top level. Chrome dispatches the event that started the worker only
// to listeners that are registered during the first run of this script.
chrome.runtime.onMessage.addListener((message: GetFlagMessage, _sender, sendResponse) => {
  if (message?.type !== 'GET_FLAG') {
    return false;
  }
  started.then(() => sendResponse(flagValueMessage()));
  // Return true to keep the message channel open for the async response.
  return true;
});
