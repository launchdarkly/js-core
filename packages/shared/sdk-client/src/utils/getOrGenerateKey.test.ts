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

  describe('anonymous namespace', () => {
    test('anonymous key does not exist so should be generated', async () => {
      (storage.get as jest.Mock).mockResolvedValue(undefined);
      const k = await getOrGenerateKey('anonymous', 'org', basicPlatform);

      expect(crypto.randomUUID).toHaveBeenCalled();
      expect(storage.get).toHaveBeenCalledWith('LaunchDarkly_AnonymousKeys_org');
      expect(storage.set).toHaveBeenCalled();
      expect(k).toEqual('test-org-key-1');
    });

    test('anonymous key exists so should not be generated', async () => {
      (storage.get as jest.Mock).mockResolvedValue('test-org-key-2');
      const k = await getOrGenerateKey('anonymous', 'org', basicPlatform);

      expect(crypto.randomUUID).not.toHaveBeenCalled();
      expect(storage.get).toHaveBeenCalledWith('LaunchDarkly_AnonymousKeys_org');
      expect(storage.set).not.toHaveBeenCalled();
      expect(k).toEqual('test-org-key-2');
    });
  });

  describe('context namespace', () => {
    test('context key does not exist so should be generated', async () => {
      (storage.get as jest.Mock).mockResolvedValue(undefined);
      const k = await getOrGenerateKey('context', 'org', basicPlatform);

      expect(crypto.randomUUID).toHaveBeenCalled();
      expect(storage.get).toHaveBeenCalledWith('LaunchDarkly_ContextKeys_org');
      expect(storage.set).toHaveBeenCalled();
      expect(k).toEqual('test-org-key-1');
    });

    test('context key exists so should not be generated', async () => {
      (storage.get as jest.Mock).mockResolvedValue('test-org-key-2');
      const k = await getOrGenerateKey('context', 'org', basicPlatform);

      expect(crypto.randomUUID).not.toHaveBeenCalled();
      expect(storage.get).toHaveBeenCalledWith('LaunchDarkly_ContextKeys_org');
      expect(storage.set).not.toHaveBeenCalled();
      expect(k).toEqual('test-org-key-2');
    });
  });

  test('unsupported namespace', async () => {
    // @ts-ignore
    await expect(getOrGenerateKey('wrongNamespace', 'org', basicPlatform)).rejects.toThrow(
      /unsupported/i,
    );
  });
});
