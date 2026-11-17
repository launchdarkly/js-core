// The content script does not run the SDK. It asks the background worker for the flag value,
// and it gets the new value from the worker when the flag changes.

import type { FlagValueMessage, GetFlagMessage } from './messages';

function logFlagValue(message: FlagValueMessage): void {
  // eslint-disable-next-line no-console
  console.log(
    `[LaunchDarkly] The ${message.flagKey} feature flag evaluates to ${String(message.value)}.`,
  );
}

chrome.runtime.onMessage.addListener((message: FlagValueMessage) => {
  if (message?.type === 'FLAG_VALUE') {
    logFlagValue(message);
  }
});

const getFlag: GetFlagMessage = { type: 'GET_FLAG' };
chrome.runtime
  .sendMessage<GetFlagMessage, FlagValueMessage>(getFlag)
  .then(logFlagValue)
  .catch((err: unknown) => {
    // This occurs, for example, after the extension reloads. The content scripts that are
    // already in open tabs can then no longer reach the extension.
    // eslint-disable-next-line no-console
    console.warn('[LaunchDarkly] Could not get the flag value:', err);
  });
