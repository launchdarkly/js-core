import { Hasher } from '@launchdarkly/js-server-sdk-common';

export const setupCrypto = () => {
  let counter = 0;
  const hasher = {
    update: jest.fn((): Hasher => hasher),
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
