import CryptoJS from 'crypto-js';
import { Hasher as LDHasher } from '@launchdarkly/js-server-sdk-common';
import { SupportedHashAlgorithm, SupportedOutputEncoding } from './types';

export default class CryptoJSHasher implements LDHasher {
  private cryptoJSHasher;

  constructor(algorithm: SupportedHashAlgorithm) {
    let algo;

    switch (algorithm) {
      case 'sha1':
        algo = CryptoJS.algo.SHA1;
        break;
      case 'sha256':
        algo = CryptoJS.algo.SHA256;
        break;
      default:
        throw new Error('unsupported hash algorithm. Only sha1 and sha256 are supported.');
    }

    this.cryptoJSHasher = algo.create();
  }

  digest(encoding: SupportedOutputEncoding): string {
    const result = this.cryptoJSHasher.finalize();

    let enc;
    switch (encoding) {
      case 'base64':
        enc = CryptoJS.enc.Base64;
        break;
      case 'hex':
        enc = CryptoJS.enc.Hex;
        break;
      default:
        throw new Error('unsupported output encoding. Only base64 and hex are supported.');
    }

    return result.toString(enc);
  }

  update(data: string): this {
    this.cryptoJSHasher.update(data);
    return this;
  }
}
