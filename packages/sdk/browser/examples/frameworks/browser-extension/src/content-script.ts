// Fields are optional because runtime messages aren't type-checked; any part
// of the extension could send a message that doesn't match this shape.
interface FlagUpdateMessage {
  type?: string;
  flagKey?: string;
  value?: unknown;
}

chrome.runtime.onMessage.addListener((message: FlagUpdateMessage) => {
  if (message?.type === 'FLAG_UPDATE') {
    // eslint-disable-next-line no-console
    console.log(`[LaunchDarkly] ${message.flagKey} = ${String(message.value)}`);
  }
});
