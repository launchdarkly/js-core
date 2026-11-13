import type { FlagValueMessage, GetFlagMessage } from '../messages';

const flagEl = document.getElementById('flag') as HTMLElement;

function render(message: FlagValueMessage): void {
  flagEl.textContent = `The ${message.flagKey} feature flag evaluates to ${String(message.value)}.`;
  document.body.style.background = message.value ? '#00844B' : '#373841';
}

// The background worker sends a new value while the popup is open and the flag changes.
chrome.runtime.onMessage.addListener((message: FlagValueMessage) => {
  if (message?.type === 'FLAG_VALUE') {
    render(message);
  }
});

const getFlag: GetFlagMessage = { type: 'GET_FLAG' };
chrome.runtime
  .sendMessage<GetFlagMessage, FlagValueMessage>(getFlag)
  .then(render)
  .catch((err: unknown) => {
    flagEl.textContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
  });
