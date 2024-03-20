import type { Crypto, Hmac } from '@launchdarkly/js-client-sdk-common';

import PlatformHasher from './PlatformHasher';
import { SupportedHashAlgorithm } from './types';

/* eslint-disable no-bitwise */
/**
 * To avoid dependencies on uuid, this is good enough for now.
 * Ripped from the react-native repo:
 * https://github.com/facebook/react-native/blob/main/packages/react-native/Libraries/Blob/BlobManager.js#L27
 *
 * Based on the rfc4122-compliant solution posted at
 * http://stackoverflow.com/questions/105034
 */
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Uses crypto-js as substitute to node:crypto because the latter
 * is not yet supported in some runtimes.
 * https://cryptojs.gitbook.io/docs/
 */
export default class PlatformCrypto implements Crypto {
  createHash(algorithm: SupportedHashAlgorithm): PlatformHasher {
    return new PlatformHasher(algorithm);
  }

  createHmac(algorithm: SupportedHashAlgorithm, key: string): Hmac {
    return new PlatformHasher(algorithm, key);
  }

  randomUUID(): string {
    return uuidv4();
  }
}
