import type { LDContext } from '@launchdarkly/js-sdk-common';
import { basicPlatform } from '@launchdarkly/private-js-mocks';

import ensureKey, { getOrGenerateKey, ns } from './ensureKey';

const { crypto, storage } = basicPlatform;
describe('ensureKey', () => {
  beforeEach(() => {
    crypto.randomUUID.mockImplementation(() => 'random123');
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('ns', async () => {
    const nsKey = await ns('org');
    expect(nsKey).toEqual('LaunchDarkly_GeneratedContextKeys_org');
  });

  test('getOrGenerateKey create new key', async () => {
    const key = await getOrGenerateKey('org', basicPlatform);

    expect(key).toEqual('random123');
    expect(crypto.randomUUID).toHaveBeenCalled();
    expect(storage.get).toHaveBeenCalledWith('LaunchDarkly_GeneratedContextKeys_org');
    expect(storage.set).toHaveBeenCalledWith('LaunchDarkly_GeneratedContextKeys_org', 'random123');
  });

  test('getOrGenerateKey existing key', async () => {
    storage.get.mockImplementation((nsKind: string) =>
      nsKind === 'LaunchDarkly_GeneratedContextKeys_org' ? 'random123' : undefined,
    );

    const key = await getOrGenerateKey('org', basicPlatform);

    expect(key).toEqual('random123');
    expect(crypto.randomUUID).not.toHaveBeenCalled();
    expect(storage.get).toHaveBeenCalledWith('LaunchDarkly_GeneratedContextKeys_org');
    expect(storage.set).not.toHaveBeenCalled();
  });

  test('ensureKey non-anonymous contexts should be unchanged', () => {
    const context: LDContext = { kind: 'org', key: 'Testy Pizza' };
    ensureKey(context, basicPlatform);

    expect(context.key).toEqual('Testy Pizza');
    expect(context.anonymous).toBeFalsy();
  });

  test.only('ensureKey should create key for single anonymous contexts', () => {
    const context: LDContext = { kind: 'org', anonymous: true, key: '' };
    ensureKey(context, basicPlatform);
    expect(context.key).toEqual('random123');
  });
});
