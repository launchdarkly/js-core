import { fromByteArray } from 'base64-js';

function convertToByteArray(s: string) {
  const b = [];
  for (let i = 0; i < s.length; i += 1) {
    b.push(s.charCodeAt(i));
  }
  return Uint8Array.from(b);
}

// eslint-disable-next-line import/prefer-default-export
export function btoa(s: string) {
  return fromByteArray(convertToByteArray(s));
}
