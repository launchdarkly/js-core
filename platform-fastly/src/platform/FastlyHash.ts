/* eslint-disable class-methods-use-this */
import { platform } from '@launchdarkly/js-server-sdk-common';

import * as CryptoJS from 'crypto-js';

const FORMATS: { [algo: string]: any } = {
  sha1: CryptoJS.algo.SHA1,
  sha256: CryptoJS.algo.SHA256,
};

const ENCODINGS: { [algo: string]: any } = {
  hex: CryptoJS.enc.Hex,
  base64: CryptoJS.enc.Base64,
};

export default class FastlyHash implements platform.Hasher {
  // TODO: Cannot seem to find the hasher type exported.
  hasher: any;

  constructor(algorithm: string) {
    const algoImpl = FORMATS[algorithm];
    this.hasher = algoImpl?.create();
  }

  update(data: string): platform.Hasher {
    this.hasher?.update(data);
    return this;
  }

  digest(encoding: string) {
    const hash = this.hasher.finalize();
    return hash.toString(ENCODINGS[encoding]);
  }
}
