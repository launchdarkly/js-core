import { Crypto, Storage } from '@launchdarkly/js-sdk-common';

import { getOrGenerateKey } from '../../src/storage/getOrGenerateKey';
import { createBasicPlatform } from '../createBasicPlatform';

let mockPlatform: ReturnType<typeof createBasicPlatform>;

beforeEach(() => {
  mockPlatform = createBasicPlatform();
});

describe('getOrGenerateKey', () => {
  let crypto: Crypto;
  let storage: Storage;

  beforeEach(() => {
    crypto = mockPlatform.crypto;
    storage = mockPlatform.storage;

    (crypto.randomUUID as jest.Mock).mockReturnValueOnce('test-org-key-1');
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('getOrGenerateKey create new key', async () => {
    const key = await getOrGenerateKey('LaunchDarkly_AnonymousKeys_org', mockPlatform);

    expect(key).toEqual('test-org-key-1');
    expect(crypto.randomUUID).toHaveBeenCalled();
    expect(storage.get).toHaveBeenCalledWith('LaunchDarkly_AnonymousKeys_org');
    expect(storage.set).toHaveBeenCalledWith('LaunchDarkly_AnonymousKeys_org', 'test-org-key-1');
  });

  test('getOrGenerateKey existing key', async () => {
    (storage.get as jest.Mock).mockImplementation((storageKey: string) =>
      storageKey === 'LaunchDarkly_AnonymousKeys_org' ? 'random1' : undefined,
    );

    const key = await getOrGenerateKey('LaunchDarkly_AnonymousKeys_org', mockPlatform);

    expect(key).toEqual('random1');
    expect(crypto.randomUUID).not.toHaveBeenCalled();
    expect(storage.get).toHaveBeenCalledWith('LaunchDarkly_AnonymousKeys_org');
    expect(storage.set).not.toHaveBeenCalled();
  });

  describe('anonymous namespace', () => {
    test('anonymous key does not exist so should be generated', async () => {
      (storage.get as jest.Mock).mockResolvedValue(undefined);
      const k = await getOrGenerateKey('LaunchDarkly_AnonymousKeys_org', mockPlatform);

      expect(crypto.randomUUID).toHaveBeenCalled();
      expect(storage.get).toHaveBeenCalledWith('LaunchDarkly_AnonymousKeys_org');
      expect(storage.set).toHaveBeenCalled();
      expect(k).toEqual('test-org-key-1');
    });

    test('anonymous key exists so should not be generated', async () => {
      (storage.get as jest.Mock).mockResolvedValue('test-org-key-2');
      const k = await getOrGenerateKey('LaunchDarkly_AnonymousKeys_org', mockPlatform);

      expect(crypto.randomUUID).not.toHaveBeenCalled();
      expect(storage.get).toHaveBeenCalledWith('LaunchDarkly_AnonymousKeys_org');
      expect(storage.set).not.toHaveBeenCalled();
      expect(k).toEqual('test-org-key-2');
    });
  });

  describe('context namespace', () => {
    test('context key does not exist so should be generated', async () => {
      (storage.get as jest.Mock).mockResolvedValue(undefined);
      const k = await getOrGenerateKey('LaunchDarkly_ContextKeys_org', mockPlatform);

      expect(crypto.randomUUID).toHaveBeenCalled();
      expect(storage.get).toHaveBeenCalledWith('LaunchDarkly_ContextKeys_org');
      expect(storage.set).toHaveBeenCalled();
      expect(k).toEqual('test-org-key-1');
    });

    test('context key exists so should not be generated', async () => {
      (storage.get as jest.Mock).mockResolvedValue('test-org-key-2');
      const k = await getOrGenerateKey('LaunchDarkly_ContextKeys_org', mockPlatform);

      expect(crypto.randomUUID).not.toHaveBeenCalled();
      expect(storage.get).toHaveBeenCalledWith('LaunchDarkly_ContextKeys_org');
      expect(storage.set).not.toHaveBeenCalled();
      expect(k).toEqual('test-org-key-2');
    });
  });
});
