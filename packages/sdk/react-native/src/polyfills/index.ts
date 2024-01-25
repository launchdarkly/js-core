import EventTarget from 'event-target-shim';

import { type Hasher, sha256 } from '../fromExternal/js-sha256';
import { base64FromByteArray, btoa } from './btoa';
import CustomEvent from './CustomEvent';

function setupPolyfill() {
  Object.assign(global, {
    EventTarget,
    CustomEvent,
  });
}
export { base64FromByteArray, btoa, type Hasher, setupPolyfill, sha256 };
