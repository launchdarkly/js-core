/* eslint-disable no-bitwise */
import { fromByteArray } from 'base64-js';

function convertToByteArray(s: string) {
  const b = [];
  for (let i = 0; i < s.length; i += 1) {
    b.push(s.charCodeAt(i));
  }
  return Uint8Array.from(b);
}

export default function btoa(s: string) {
  return fromByteArray(convertToByteArray(s));
}
