/* eslint-disable class-methods-use-this */
// TODO: DRY out vercel/cloudflare/shared stuff
import type { Crypto, Hasher, Hmac } from '@launchdarkly/js-server-sdk-common';
import CryptoJSHasher from './cryptoJSHasher';
import CryptoJSHmac from './cryptoJSHmac';
import { SupportedHashAlgorithm } from './types';

/**
 * Uses crypto-js as substitute to node:crypto because we do so
 * for cloudflare and this way we can DRY up down the line
 */
export default class VercelCrypto implements Crypto {
  createHash(algorithm: SupportedHashAlgorithm): Hasher {
    return new CryptoJSHasher(algorithm);
  }

  createHmac(algorithm: SupportedHashAlgorithm, key: string): Hmac {
    return new CryptoJSHmac(algorithm, key);
  }

  randomUUID(): string {
    // This is available in Vercel Edge
    // TODO: Use tsconfig instead of ts-ignore
    // @ts-ignore
    return crypto.randomUUID();
  }
}
