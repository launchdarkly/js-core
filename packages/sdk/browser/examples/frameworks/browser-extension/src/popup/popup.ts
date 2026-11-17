import type { DataSourceStateMessage, FlagValueMessage, GetFlagMessage } from '../messages';

const flagEl = document.getElementById('flag') as HTMLElement;
const statusEl = document.getElementById('status') as HTMLElement;

// Use textContent, not innerHTML, in this file. Content scripts can also send messages to the
// popup, so the messages are not trusted.

// When the state is not VALID, the value can come from the cache or be the default value.
function renderDataSourceState(state: string | undefined): void {
  statusEl.textContent = state && state !== 'VALID' ? `SDK data source state: ${state}` : '';
}

function render(message: FlagValueMessage): void {
  flagEl.textContent = `The ${message.flagKey} feature flag evaluates to ${String(message.value)}.`;
  document.body.style.background = message.value ? '#00844B' : '#373841';
  renderDataSourceState(message.dataSourceState);
}

// The background worker sends new values and states while the popup is open.
chrome.runtime.onMessage.addListener((message: FlagValueMessage | DataSourceStateMessage) => {
  if (message?.type === 'FLAG_VALUE') {
    render(message);
  } else if (message?.type === 'DATA_SOURCE_STATE') {
    renderDataSourceState(message.state);
  }
});

const getFlag: GetFlagMessage = { type: 'GET_FLAG' };
chrome.runtime
  .sendMessage<GetFlagMessage, FlagValueMessage>(getFlag)
  .then(render)
  .catch((err: unknown) => {
    flagEl.textContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
  });
