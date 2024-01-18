import type { LDContext, LDContextCommon, LDUser } from '@launchdarkly/js-sdk-common';
import { basicPlatform } from '@launchdarkly/private-js-mocks';

import ensureKey, { getOrGenerateKey, ns } from './ensureKey';

const { crypto, storage } = basicPlatform;
describe('ensureKey', () => {
  beforeEach(() => {
    crypto.randomUUID.mockReturnValueOnce('random1').mockReturnValueOnce('random2');
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('ns', async () => {
    const nsKey = await ns('org');
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
    storage.get.mockImplementation((nsKind: string) =>
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
    await ensureKey(context, basicPlatform);

    expect(context.key).toEqual('Testy Pizza');
  });

  test('ensureKey non-anonymous single context should be unchanged', async () => {
    const context: LDContext = { kind: 'org', key: 'Testy Pizza' };
    await ensureKey(context, basicPlatform);

    expect(context.key).toEqual('Testy Pizza');
    expect(context.anonymous).toBeFalsy();
  });

  test('ensureKey non-anonymous contexts in multi should be unchanged', async () => {
    const context: LDContext = {
      kind: 'multi',
      user: { key: 'userKey' },
      org: { key: 'orgKey' },
    };

    await ensureKey(context, basicPlatform);

    expect((context.user as LDContextCommon).key).toEqual('userKey');
    expect((context.org as LDContextCommon).key).toEqual('orgKey');
  });

  test('ensureKey should create key for single anonymous context', async () => {
    const context: LDContext = { kind: 'org', anonymous: true, key: '' };
    await ensureKey(context, basicPlatform);
    expect(context.key).toEqual('random1');
  });

  test('ensureKey should create key for an anonymous context in multi', async () => {
    const context: LDContext = {
      kind: 'multi',
      user: { anonymous: true, key: '' },
      org: { key: 'orgKey' },
    };

    await ensureKey(context, basicPlatform);

    expect((context.user as LDContextCommon).key).toEqual('random1');
    expect((context.org as LDContextCommon).key).toEqual('orgKey');
  });

  test('ensureKey should create key for all anonymous contexts in multi', async () => {
    const context: LDContext = {
      kind: 'multi',
      user: { anonymous: true, key: '' },
      org: { anonymous: true, key: '' },
    };

    await ensureKey(context, basicPlatform);

    expect((context.user as LDContextCommon).key).toEqual('random1');
    expect((context.org as LDContextCommon).key).toEqual('random2');
  });

  test('ensureKey should create key for anonymous legacy user', async () => {
    const context: LDUser = {
      anonymous: true,
      key: '',
    };
    await ensureKey(context, basicPlatform);
    expect(context.key).toEqual('random1');
  });
});
