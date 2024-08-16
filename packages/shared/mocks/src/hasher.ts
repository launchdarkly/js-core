import type { Crypto, Hasher, Hmac } from '@common';

const hasher: Hasher = {
  update: jest.fn(() => hasher),
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
  randomUUID: jest.fn(() => {
    counter += 1;
    // Will provide a unique value for tests.
    // Very much not a UUID of course.
    return `${counter}`;
  }),
};
