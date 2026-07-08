// Import only the crypto-js submodules we use. Importing the crypto-js entry point
// pulls in the entire cipher suite (AES, DES, Rabbit, MD5, SHA3, PBKDF2, ...), which
// bloats the Wasm bundle and cold-start parse time. The type namespace comes from
// 'crypto-js/core'; the algorithm and encoder submodules register themselves on it at
// runtime (enc.Hex is part of core).
import CryptoJS from 'crypto-js/core';
import 'crypto-js/sha1';
import 'crypto-js/sha256';
import 'crypto-js/enc-base64';

import { Hasher as LDHasher } from '@launchdarkly/js-server-sdk-common';

import { SupportedHashAlgorithm, SupportedOutputEncoding } from './types';

export default class CryptoJSHasher implements LDHasher {
  private _cryptoJSHasher;

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

    this._cryptoJSHasher = algo.create();
  }

  digest(encoding: SupportedOutputEncoding): string {
    const result = this._cryptoJSHasher.finalize();

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
    this._cryptoJSHasher.update(data);
    return this;
  }
}
