import type { Hasher } from '@launchdarkly/js-sdk-common';

import { concatNamespacesAndValues } from './namespaceUtils';

describe('concatNamespacesAndValues tests', () => {
  test('it handles one part', async () => {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const mockCrypto = makeMockCrypto();

    const result = concatNamespacesAndValues(mockCrypto, [{ value: 'LaunchDarkly', hashIt: true }]);

    expect(result).toEqual('LaunchDarklyHashed');
  });

  test('it handles empty parts', async () => {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const mockCrypto = makeMockCrypto();

    const result = concatNamespacesAndValues(mockCrypto, []);

    expect(result).toEqual('');
  });

  test('it handles many parts', async () => {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const mockCrypto = makeMockCrypto();

    const result = concatNamespacesAndValues(mockCrypto, [
      { value: 'LaunchDarkly', hashIt: false },
      { value: 'ContextKeys', hashIt: false },
      { value: 'aKind', hashIt: false },
    ]);

    expect(result).toEqual('LaunchDarkly_ContextKeys_aKind');
  });

  test('it handles mixture of hashing and no hashing', async () => {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const mockCrypto = makeMockCrypto();

    const result = concatNamespacesAndValues(mockCrypto, [
      { value: 'LaunchDarkly', hashIt: true },
      { value: 'ContextKeys', hashIt: false },
      { value: 'aKind', hashIt: true },
    ]);

    expect(result).toEqual('LaunchDarklyHashed_ContextKeys_aKindHashed');
  });
});

function makeMockCrypto() {
  let counter = 0;
  let lastInput = '';
  const hasher: Hasher = {
    update: jest.fn((input) => {
      lastInput = input;
      return hasher;
    }),
    digest: jest.fn(() => `${lastInput}Hashed`),
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
}
