/* eslint-disable no-bitwise */
import { fromByteArray } from 'base64-js';

function convertToByteArray(s: string) {
  const b = [];
  for (let i = 0; i < s.length; i += 1) {
    b.push(s.charCodeAt(i));
  }
  return Uint8Array.from(b);
}

export function btoa(s: string) {
  return fromByteArray(convertToByteArray(s));
}

/**
 * Based on the rfc4122-compliant solution posted at
 * http://stackoverflow.com/questions/105034
 */
export function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
