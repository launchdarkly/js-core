import type { Crypto, Hasher, Hmac } from 'shared-common-types';

export const hasher: Hasher = {
  update: jest.fn(),
  digest: jest.fn(() => '1234567890123456'),
};

let counter = 0;

export const crypto: Crypto = {
  createHash(algorithm: string): Hasher {
    expect(algorithm).toEqual('sha1');
    return hasher;
  },
  createHmac(algorithm: string, key: string): Hmac {
    // Not used for this test.
    throw new Error(`Function not implemented.${algorithm}${key}`);
  },
  randomUUID(): string {
    counter += 1;
    // Will provide a unique value for tests.
    // Very much not a UUID of course.
    return `${counter}`;
  },
};
