import { LDClientCallbacks } from '../src/LDClientImpl';

export function makeCallbacks(listenEvents: boolean): LDClientCallbacks {
  return {
    onError: () => { },
    onFailed: () => { },
    onReady: () => { },
    onUpdate: () => { },
    hasEventListeners: () => listenEvents,
  };
}
