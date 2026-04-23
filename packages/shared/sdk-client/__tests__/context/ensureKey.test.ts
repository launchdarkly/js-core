import type {
  Crypto,
  LDContextCommon,
  LDMultiKindContext,
  LDUser,
} from '@launchdarkly/js-sdk-common';

import { LDContext } from '../../src/api/LDContext';
import { ensureKey } from '../../src/context/ensureKey';
import { createBasicPlatform } from '../createBasicPlatform';

let mockPlatform: ReturnType<typeof createBasicPlatform>;

beforeEach(() => {
  mockPlatform = createBasicPlatform();
});

describe('ensureKey', () => {
  let crypto: Crypto;

  beforeEach(() => {
    crypto = mockPlatform.crypto;

    (crypto.randomUUID as jest.Mock).mockReturnValueOnce('random1').mockReturnValueOnce('random2');
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('ensureKey should not override anonymous key if specified', async () => {
    const context: LDContext = { kind: 'org', anonymous: true, key: 'Testy Pizza' };
    const c = await ensureKey(context, mockPlatform);

    expect(c.key).toEqual('Testy Pizza');
  });

  test('ensureKey non-anonymous single context should be unchanged', async () => {
    const context: LDContext = { kind: 'org', key: 'Testy Pizza' };
    const c = await ensureKey(context, mockPlatform);

    expect(c.key).toEqual('Testy Pizza');
    expect(c.anonymous).toBeFalsy();
  });

  test('ensureKey non-anonymous contexts in multi should be unchanged', async () => {
    const context: LDContext = {
      kind: 'multi',
      user: { key: 'userKey' },
      org: { key: 'orgKey' },
    };

    const c = (await ensureKey(context, mockPlatform)) as LDMultiKindContext;

    expect((c.user as LDContextCommon).key).toEqual('userKey');
    expect((c.org as LDContextCommon).key).toEqual('orgKey');
  });

  test('ensureKey should create key for single anonymous context', async () => {
    const context: LDContext = { kind: 'org', anonymous: true };
    const c = await ensureKey(context, mockPlatform);
    expect(c.key).toEqual('random1');
  });

  test('ensureKey should create key for single anonymous context with empty key string', async () => {
    const context: LDContext = { kind: 'org', anonymous: true, key: '' };
    const c = await ensureKey(context, mockPlatform);
    expect(c.key).toEqual('random1');
  });

  test('ensureKey should create key for an anonymous context in multi', async () => {
    const context: LDContext = {
      kind: 'multi',
      user: { anonymous: true },
      org: { key: 'orgKey' },
    };

    const c = (await ensureKey(context, mockPlatform)) as LDMultiKindContext;

    expect((c.user as LDContextCommon).key).toEqual('random1');
    expect((c.org as LDContextCommon).key).toEqual('orgKey');
  });

  test('ensureKey should create key for all anonymous contexts in multi', async () => {
    const context: LDContext = {
      kind: 'multi',
      user: { anonymous: true },
      org: { anonymous: true, key: '' },
    };

    const c = (await ensureKey(context, mockPlatform)) as LDMultiKindContext;

    expect((c.user as LDContextCommon).key).toEqual('random1');
    expect((c.org as LDContextCommon).key).toEqual('random2');
  });

  test('ensureKey should create key for anonymous legacy user', async () => {
    const context: LDUser = {
      anonymous: true,
      key: '',
    };
    const c = await ensureKey(context, mockPlatform);
    expect(c.key).toEqual('random1');
  });

  it('should migrate anonymous key from legacy namespace', async () => {
    const stored: Record<string, string> = {
      LaunchDarkly_AnonymousKeys_org: 'migrated-key',
    };
    (mockPlatform.storage.get as jest.Mock).mockImplementation(
      (key: string) => stored[key] ?? null,
    );
    (mockPlatform.storage.set as jest.Mock).mockImplementation((key: string, value: string) => {
      stored[key] = value;
    });
    (mockPlatform.storage.clear as jest.Mock).mockImplementation((key: string) => {
      delete stored[key];
    });

    const context: LDContext = { kind: 'org', anonymous: true };
    const c = await ensureKey(context, mockPlatform);

    expect(c.key).toEqual('migrated-key');
    expect(mockPlatform.storage.set).toHaveBeenCalledWith(
      'LaunchDarkly_ContextKeys_org',
      'migrated-key',
    );
    expect(mockPlatform.storage.clear).toHaveBeenCalledWith('LaunchDarkly_AnonymousKeys_org');
  });

  it('should use new namespace key when it already exists', async () => {
    (mockPlatform.storage.get as jest.Mock).mockImplementation((key: string) =>
      key === 'LaunchDarkly_ContextKeys_org' ? 'new-ns-key' : undefined,
    );

    const context: LDContext = { kind: 'org', anonymous: true };
    const c = await ensureKey(context, mockPlatform);

    expect(c.key).toEqual('new-ns-key');
    expect(mockPlatform.storage.clear).not.toHaveBeenCalled();
  });
});
