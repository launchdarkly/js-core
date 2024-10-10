import { algo as CryptoAlgo } from 'crypto-js';
import Base64 from 'crypto-js/enc-base64';
import Hex from 'crypto-js/enc-hex';

import { Hasher as LDHasher } from '@launchdarkly/js-server-sdk-common';

import { SupportedHashAlgorithm, SupportedOutputEncoding } from './types';

export default class CryptoJSHasher implements LDHasher {
  private _cryptoJSHasher;

  constructor(algorithm: SupportedHashAlgorithm) {
    let algo;

    switch (algorithm) {
      case 'sha1':
        algo = CryptoAlgo.SHA1;
        break;
      case 'sha256':
        algo = CryptoAlgo.SHA256;
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
        enc = Base64;
        break;
      case 'hex':
        enc = Hex;
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
