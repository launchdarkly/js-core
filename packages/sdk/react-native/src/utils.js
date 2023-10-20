import { fromByteArray } from 'base64-js';
function convertToByteArray(s) {
    const b = [];
    for (let i = 0; i < s.length; i += 1) {
        b.push(s.charCodeAt(i));
    }
    return Uint8Array.from(b);
}
export function btoa(s) {
    return fromByteArray(convertToByteArray(s));
}
