import { algo as CryptoAlgo } from 'crypto-js';

import { Hasher as LDHasher } from '@launchdarkly/js-client-sdk-common';

import { Hasher, sha256 } from '../../fromExternal/js-sha256';
import { base64FromByteArray } from '../../polyfills';
import { SupportedHashAlgorithm, SupportedOutputEncoding } from './types';

export default class PlatformHasher implements LDHasher {
  private hasher: Hasher;

  constructor(algorithm: SupportedHashAlgorithm, hmacKey?: string) {
    switch (algorithm) {
      case 'sha256':
        this.hasher = hmacKey ? sha256.hmac.create(hmacKey) : sha256.create();
        break;
      default:
        throw new Error(`Unsupported hash algorithm: ${algorithm}. Only sha256 is supported.`);
    }
  }

  digest(encoding: SupportedOutputEncoding): string {
    switch (encoding) {
      case 'base64':
        return base64FromByteArray(new Uint8Array(this.hasher.arrayBuffer()));
      case 'hex':
        return this.hasher.hex();
      default:
        throw new Error('unsupported output encoding. Only base64 and hex are supported.');
    }
  }

  update(data: string): this {
    this.hasher.update(data);
    return this;
  }
}
