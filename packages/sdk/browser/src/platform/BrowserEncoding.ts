import { Encoding } from '@launchdarkly/js-client-sdk-common';

function bytesToBase64(bytes: Uint8Array) {
  const binString = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join('');
  return btoa(binString);
}

/**
 * Implementation Note: This btoa handles unicode characters, which the base btoa in the browser
 * does not.
 * Background: https://developer.mozilla.org/en-US/docs/Glossary/Base64#the_unicode_problem
 */

export default class BrowserEncoding implements Encoding {
  btoa(data: string): string {
    return bytesToBase64(new TextEncoder().encode(data));
  }
}
