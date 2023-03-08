import { LDClientCallbacks } from '../src/LDClientImpl';

export default function makeCallbacks(listenEvents: boolean): LDClientCallbacks {
  return {
    onError: () => {},
    onFailed: () => {},
    onReady: () => {},
    onUpdate: () => {},
    hasEventListeners: () => listenEvents,
  };
}
