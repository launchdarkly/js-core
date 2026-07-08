import { createClient, LDContext } from '@launchdarkly/js-client-sdk';

import { createChromeStorageAdapter } from './storage/chromeStorageAdapter';

// Replaced at build time by tsdown from the .env file (see tsdown.config.ts).
const clientSideID = 'LD_CLIENT_SIDE_ID';
const flagKey = 'LD_FLAG_KEY';

// Static context: this POC has no signed-in user, so every evaluation uses
// the same key.
const context: LDContext = {
  kind: 'user',
  key: 'extension-user-key',
  name: 'Extension User',
};

// createClient never touches window/document at construction (BrowserApi
// guards every access), so it's safe to build at service-worker top level.
// streaming:false skips EventSource, which service workers don't have.
// fetchGoals:false skips document.querySelectorAll.
// automaticBackgroundHandling:false skips window visibility/focus listeners.
const client = createClient(clientSideID, context, {
  streaming: false,
  fetchGoals: false,
  automaticBackgroundHandling: false,
  storage: createChromeStorageAdapter(),
});

// client.start() is idempotent and we eagerly call it to ensure things can
// still work even when worker threads get recreated.
function ensureStarted(): Promise<unknown> {
  return client
    .start({ timeout: 5 })
    .then((result) => {
      // Logged instead of swallowed, so a timeout or failed init shows up in the
      // service worker console during manual testing instead of looking like a
      // real `false` flag value.
      // eslint-disable-next-line no-console
      console.log(`[LaunchDarkly] initialization status: ${result.status}`);
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.log('[LaunchDarkly] initialization error:', err);
    });
}

async function getFlagValue(): Promise<{ flagKey: string; value: unknown }> {
  await ensureStarted();
  return { flagKey, value: client.variation(flagKey, false) };
}

client.on('change', (_context: LDContext, flagKeys: string[]) => {
  // eslint-disable-next-line no-console
  console.log('[LaunchDarkly] change event fired', { flagKeys });
});

// Start eagerly so the built-in poller begins running as soon as the service
// worker loads, rather than waiting for a popup click to trigger it.
ensureStarted();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'GET_FLAG') {
    getFlagValue().then(sendResponse);
    // Returning true keeps the message channel open for the async response.
    return true;
  }
  return false;
});
