import type { Hasher } from '@common';

// eslint-disable-next-line import/no-mutable-exports
export let hasher: Hasher;

export const setupCrypto = () => {
  let counter = 0;
  hasher = {
    update: jest.fn(() => { return hasher }),
    digest: jest.fn(() => '1234567890123456'),
  };

  return {
    createHash: jest.fn(() => hasher),
    createHmac: jest.fn(),
    randomUUID: jest.fn(() => {
      counter += 1;
      // Will provide a unique value for tests.
      // Very much not a UUID of course.
      return `${counter}`;
    }),
  };
};
