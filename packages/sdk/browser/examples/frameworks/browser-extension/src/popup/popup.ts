interface FlagResponse {
  flagKey: string;
  value: unknown;
}

const flagEl = document.getElementById('flag');

chrome.runtime.sendMessage({ type: 'GET_FLAG' }, (response: FlagResponse | undefined) => {
  if (!flagEl) {
    return;
  }
  if (chrome.runtime.lastError) {
    flagEl.textContent = `Error: ${chrome.runtime.lastError.message}`;
    return;
  }
  if (!response) {
    flagEl.textContent = 'No response from background worker';
    return;
  }

  flagEl.textContent = `${response.flagKey} = ${String(response.value)}`;

  // Propagate the value to the active tab's content script.
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs[0]?.id;
    if (tabId === undefined) {
      return;
    }
    chrome.tabs.sendMessage(
      tabId,
      { type: 'FLAG_UPDATE', flagKey: response.flagKey, value: response.value },
      () => {
        // Swallow "receiving end does not exist" errors on pages where the
        // content script is not injected (e.g. chrome:// pages).
        void chrome.runtime.lastError;
      },
    );
  });
});
