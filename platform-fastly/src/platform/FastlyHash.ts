/* eslint-disable class-methods-use-this */
import { platform } from '@launchdarkly/js-server-sdk-common';

import * as crypto from 'crypto-js';

export default class FastlyHash implements platform.Hasher {
  hashFormat: string;

  constructor(algorithm: string) {
    this.hashFormat = algorithm;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  update(data: string): platform.Hasher {
    return new FastlyHash(this.hashFormat);
  }

  digest(encoding: string) {
    return this.getHash()!.create().finalize(encoding).toString();
  }

  private getHash() {
    let hashType;
    switch (this.hashFormat) {
      case 'sha1':
        hashType = crypto.algo.SHA1;
        break;
      case 'sha256':
        hashType = crypto.algo.SHA256;
        break;
      default:
        break;
    }

    return hashType;
  }
}
