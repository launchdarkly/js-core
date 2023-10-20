import EventSourcePolyfill from 'react-native-sse';
// TODO:
// @ts-ignore
export default class ReactNativeEventSource extends EventSourcePolyfill {
    constructor(url, eventSourceInitDict) {
        super(url, eventSourceInitDict);
        this.addEventListener('close', this.onclose);
        this.addEventListener('error', this.onerror);
        this.addEventListener('open', this.onopen);
        // this.addEventListener(<EventType>'retrying', this.onretrying);
    }
    onclose() { }
    onerror() { }
    onopen() { }
}
