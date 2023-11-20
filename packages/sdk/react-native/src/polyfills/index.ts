import EventTarget from 'event-target-shim';

import btoa from './btoa';
import CustomEvent from './CustomEvent';
import EventSource from './react-native-sse';
import uuidv4 from './uuid';

function setupPolyfill() {
  Object.assign(global, {
    EventTarget,
    CustomEvent,
  });
}
export { btoa, EventSource, setupPolyfill, uuidv4 };
