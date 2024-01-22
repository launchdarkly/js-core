import type { Crypto, Hasher } from '@common';

// HACK: inject hasher so we can easily test calls to update & digest
export type CryptoWithHash = Crypto & { hasher: Hasher };
// eslint-disable-next-line import/no-mutable-exports
export let crypto: CryptoWithHash;

export const setupCrypto = () => {
  let counter = 0;
  const hasher: Hasher = {
    update: jest.fn(),
    digest: jest.fn(() => '1234567890123456'),
  };

  crypto = {
    hasher,
    createHash: jest.fn(() => hasher),
    createHmac: jest.fn(),
    randomUUID: jest.fn(() => {
      counter += 1;
      // Will provide a unique value for tests.
      // Very much not a UUID of course.
      return `${counter}`;
    }),
  };

  return crypto;
};
