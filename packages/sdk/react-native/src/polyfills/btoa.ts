/* eslint-disable no-bitwise */
import { fromByteArray } from 'base64-js';

import toUtf8Array from './toUtf8Array';

export function btoa(s: string) {
  return fromByteArray(toUtf8Array(s));
}

export function base64FromByteArray(a: Uint8Array) {
  return fromByteArray(a);
}
