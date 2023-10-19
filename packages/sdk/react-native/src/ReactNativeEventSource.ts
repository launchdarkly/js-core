import EventSourcePolyfill from 'react-native-sse';

import type { EventSource, EventSourceInitDict } from '@launchdarkly/js-sdk-common';

// TODO:
// @ts-ignore
export default class ReactNativeEventSource extends EventSourcePolyfill implements EventSource {
  constructor(url: string, eventSourceInitDict: EventSourceInitDict) {
    super(url, eventSourceInitDict);
    this.addEventListener('close', this.onclose);
    this.addEventListener('error', this.onerror);
    this.addEventListener('open', this.onopen);
    // this.addEventListener(<EventType>'retrying', this.onretrying);
  }
  onclose(): void {}

  onerror(): void {}

  onopen(): void {}

  // onretrying(): void {}
}
