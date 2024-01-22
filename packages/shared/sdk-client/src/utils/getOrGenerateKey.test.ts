import { Crypto, Storage } from '@launchdarkly/js-sdk-common';
import { basicPlatform } from '@launchdarkly/private-js-mocks';

import { getOrGenerateKey } from './getOrGenerateKey';

describe('getOrGenerateKey', () => {
  let crypto: Crypto;
  let storage: Storage;

  beforeEach(() => {
    crypto = basicPlatform.crypto;
    storage = basicPlatform.storage;

    (crypto.randomUUID as jest.Mock).mockResolvedValue('test-org-key-1');
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('key does not exist in cache so it must be generated', async () => {
    (storage.get as jest.Mock).mockResolvedValue(undefined);
    const k = await getOrGenerateKey('org', basicPlatform);

    expect(crypto.randomUUID).toHaveBeenCalled();
    expect(storage.set).toHaveBeenCalled();
    expect(k).toEqual('test-org-key-1');
  });

  test('key exists in cache so not generated', async () => {
    (storage.get as jest.Mock).mockResolvedValue('test-org-key-2');
    const k = await getOrGenerateKey('org', basicPlatform);

    expect(crypto.randomUUID).not.toHaveBeenCalled();
    expect(storage.set).not.toHaveBeenCalled();
    expect(k).toEqual('test-org-key-2');
  });
});
