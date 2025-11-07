import { algo as CryptoAlgo } from 'crypto-js';

import { Hmac as LDHmac } from '@launchdarkly/js-server-sdk-common';

import { SupportedHashAlgorithm, SupportedOutputEncoding } from './types';

export default class CryptoJSHmac implements LDHmac {
  private _cryptoJSHmac;

  constructor(algorithm: SupportedHashAlgorithm, key: string) {
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

    this._cryptoJSHmac = CryptoAlgo.HMAC.create(algo, key);
  }

  digest(encoding: SupportedOutputEncoding): string {
    const result = this._cryptoJSHmac.finalize();

    if (encoding === 'base64') {
      return result.toString(CryptoJS.enc.Base64);
    }

    if (encoding === 'hex') {
      return result.toString(CryptoJS.enc.Hex);
    }

    throw new Error('unsupported output encoding. Only base64 and hex are supported.');
  }

  update(data: string): this {
    this._cryptoJSHmac.update(data);
    return this;
  }
}
