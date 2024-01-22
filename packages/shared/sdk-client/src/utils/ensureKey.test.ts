import type {
  Crypto,
  LDContext,
  LDContextCommon,
  LDMultiKindContext,
  LDUser,
  Storage,
} from '@launchdarkly/js-sdk-common';
import { basicPlatform } from '@launchdarkly/private-js-mocks';

import ensureKey from './ensureKey';
import { addNamespace, getOrGenerateKey } from './getOrGenerateKey';

describe('ensureKey', () => {
  let crypto: Crypto;
  let storage: Storage;

  beforeEach(() => {
    crypto = basicPlatform.crypto;
    storage = basicPlatform.storage;

    (crypto.randomUUID as jest.Mock).mockReturnValueOnce('random1').mockReturnValueOnce('random2');
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('addNamespace', async () => {
    const nsKey = addNamespace('org');
    expect(nsKey).toEqual('LaunchDarkly_AnonKeys_org');
  });

  test('getOrGenerateKey create new key', async () => {
    const key = await getOrGenerateKey('org', basicPlatform);

    expect(key).toEqual('random1');
    expect(crypto.randomUUID).toHaveBeenCalled();
    expect(storage.get).toHaveBeenCalledWith('LaunchDarkly_AnonKeys_org');
    expect(storage.set).toHaveBeenCalledWith('LaunchDarkly_AnonKeys_org', 'random1');
  });

  test('getOrGenerateKey existing key', async () => {
    (storage.get as jest.Mock).mockImplementation((nsKind: string) =>
      nsKind === 'LaunchDarkly_AnonKeys_org' ? 'random1' : undefined,
    );

    const key = await getOrGenerateKey('org', basicPlatform);

    expect(key).toEqual('random1');
    expect(crypto.randomUUID).not.toHaveBeenCalled();
    expect(storage.get).toHaveBeenCalledWith('LaunchDarkly_AnonKeys_org');
    expect(storage.set).not.toHaveBeenCalled();
  });

  test('ensureKey should not override anonymous key if specified', async () => {
    const context: LDContext = { kind: 'org', anonymous: true, key: 'Testy Pizza' };
    const c = await ensureKey(context, basicPlatform);

    expect(c.key).toEqual('Testy Pizza');
  });

  test('ensureKey non-anonymous single context should be unchanged', async () => {
    const context: LDContext = { kind: 'org', key: 'Testy Pizza' };
    const c = await ensureKey(context, basicPlatform);

    expect(c.key).toEqual('Testy Pizza');
    expect(c.anonymous).toBeFalsy();
  });

  test('ensureKey non-anonymous contexts in multi should be unchanged', async () => {
    const context: LDContext = {
      kind: 'multi',
      user: { key: 'userKey' },
      org: { key: 'orgKey' },
    };

    const c = (await ensureKey(context, basicPlatform)) as LDMultiKindContext;

    expect((c.user as LDContextCommon).key).toEqual('userKey');
    expect((c.org as LDContextCommon).key).toEqual('orgKey');
  });

  test('ensureKey should create key for single anonymous context', async () => {
    const context: LDContext = { kind: 'org', anonymous: true, key: '' };
    const c = await ensureKey(context, basicPlatform);
    expect(c.key).toEqual('random1');
  });

  test('ensureKey should create key for an anonymous context in multi', async () => {
    const context: LDContext = {
      kind: 'multi',
      user: { anonymous: true, key: '' },
      org: { key: 'orgKey' },
    };

    const c = (await ensureKey(context, basicPlatform)) as LDMultiKindContext;

    expect((c.user as LDContextCommon).key).toEqual('random1');
    expect((c.org as LDContextCommon).key).toEqual('orgKey');
  });

  test('ensureKey should create key for all anonymous contexts in multi', async () => {
    const context: LDContext = {
      kind: 'multi',
      user: { anonymous: true, key: '' },
      org: { anonymous: true, key: '' },
    };

    const c = (await ensureKey(context, basicPlatform)) as LDMultiKindContext;

    expect((c.user as LDContextCommon).key).toEqual('random1');
    expect((c.org as LDContextCommon).key).toEqual('random2');
  });

  test('ensureKey should create key for anonymous legacy user', async () => {
    const context: LDUser = {
      anonymous: true,
      key: '',
    };
    const c = await ensureKey(context, basicPlatform);
    expect(c.key).toEqual('random1');
  });
});
