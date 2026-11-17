import { createClient, type LDContext } from '@launchdarkly/js-client-sdk';
import { fetchBrowserEventSource } from '@launchdarkly/js-client-sdk/fetch-eventsource';

import type { DataSourceStateMessage, FlagValueMessage, GetFlagMessage } from './messages';
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

// A Manifest V3 service worker has no document and no localStorage.
// - eventSource: fetchBrowserEventSource streams flag updates over fetch(). Unlike the native
//   EventSource, it can send request headers, it can use REPORT or POST, it reports HTTP
//   error statuses to the SDK, and it applies a read timeout.
// - storage keeps the cached context and flag values in chrome.storage.local.
// - fetchGoals: false turns off goals, because goals need a document.
const client = createClient(clientSideID, context, {
  eventSource: fetchBrowserEventSource,
  streaming: true,
  fetchGoals: false,
  storage: createChromeStorageAdapter(),
});

// By default, content scripts can read and write chrome.storage.local. Content scripts run in web
// pages, so they are less trusted. Only the extension itself needs the SDK flag cache. Chrome
// supports this call on chrome.storage.local from version 140, so manifest.json requires it.
chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });

let dataSourceState: string | undefined;

function flagValueMessage(): FlagValueMessage {
  const value = client.variation(flagKey, false);
  // Chrome can stop the worker suddenly, for example when the browser closes or the extension
  // updates. Queued events are then lost. This flush prevents that, but it sends one events
  // request for each evaluation instead of one batch every flush interval.
  client.flush();
  return { type: 'FLAG_VALUE', flagKey, value, dataSourceState };
}

function broadcast(message: FlagValueMessage): void {
  // The popup gets this message only when it is open. If no extension page listens, the
  // promise rejects, and that is not an error here.
  chrome.runtime.sendMessage(message).catch(() => {});

  // A tab that has no content script also rejects the message. Examples are chrome:// pages and
  // tabs that were open before the extension was installed.
  chrome.tabs
    .query({})
    .then((tabs) => {
      tabs.forEach((tab) => {
        if (tab.id !== undefined) {
          chrome.tabs.sendMessage(tab.id, message).catch(() => {});
        }
      });
    })
    .catch(() => {});
}

// The stream delivers flag updates while the service worker runs. Send the new value to all
// listeners, so that they do not have to ask again. Register this listener before start(), so
// that it also gets the change from the cached flags.
client.on('change', (_context: LDContext, changedKeys: string[]) => {
  if (changedKeys.includes(flagKey)) {
    broadcast(flagValueMessage());
  }
});

// The data source state shows if the SDK has current data from LaunchDarkly. It changes, for
// example, when a failed first request later succeeds. The popup shows the state, so a wrong
// client-side ID does not look like a real flag value.
client.on('dataSourceStatus', (status: { state: string }) => {
  dataSourceState = status.state;
  const message: DataSourceStateMessage = { type: 'DATA_SOURCE_STATE', state: status.state };
  // The popup gets this message only when it is open.
  chrome.runtime.sendMessage(message).catch(() => {});
});

// Chrome can stop the service worker when it is idle and start it again for the next event.
// This code runs again on each start. The SDK first loads the cached flag values from storage
// and then opens a new stream.
const started = client.start({ timeout: 5 }).then(({ status }) => {
  // eslint-disable-next-line no-console
  console.log(`[LaunchDarkly] initialization status: ${status}`);
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
