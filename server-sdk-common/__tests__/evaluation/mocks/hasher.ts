// Mock hashing implementation.

import { Crypto, Hasher, Hmac } from '../../../src/platform';

export const hasher: Hasher = {
  update: jest.fn(),
  digest: jest.fn(() => '1234567890123456'),
};

export const crypto: Crypto = {
  createHash(algorithm: string): Hasher {
    expect(algorithm).toEqual('sha1');
    return hasher;
  },
  createHmac(algorithm: string, key: string): Hmac {
    // Not used for this test.
    throw new Error(`Function not implemented.${algorithm}${key}`);
  },
};
