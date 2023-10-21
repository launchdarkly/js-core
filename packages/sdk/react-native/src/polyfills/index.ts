import EventTarget from 'event-target-shim';

import CustomEvent from './CustomEvent';

export default function setupPolyfill() {
  Object.assign(global, {
    EventTarget,
    CustomEvent,
  });
}
