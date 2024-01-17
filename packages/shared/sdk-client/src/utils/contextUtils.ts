import {
  Crypto,
  LDContext,
  LDContextCommon,
  LDMultiKindContext,
  LDSingleKindContext,
  LDUser,
  Platform,
  Storage,
} from '@launchdarkly/js-sdk-common';
import { isLegacyUser, isMultiKind, isSingleKind } from '@launchdarkly/js-sdk-common/dist/Context';

// Namespace string is ripped from the Flutter SDK.
export const ns = (s: string) => `LaunchDarkly_GeneratedContextKeys_${s}`;

export const getOrGenerateKey = async (kind: string, crypto: Crypto, storage?: Storage) => {
  const nsKind = ns(kind);
  let contextKey = await storage?.get(nsKind);

  if (!contextKey) {
    contextKey = crypto.randomUUID();
    await storage?.set(nsKind, contextKey);
  }

  return contextKey;
};

const ensureKeyCommon = async (kind: string, c: LDContextCommon, { crypto, storage }: Platform) => {
  const { anonymous, key } = c;

  if (anonymous && !key) {
    // eslint-disable-next-line no-param-reassign
    c.key = await getOrGenerateKey(kind, crypto, storage);
  }
};

export const ensureKeySingle = async (c: LDSingleKindContext, platform: Platform) => {
  await ensureKeyCommon(c.kind, c, platform);
};

export const ensureKeyMulti = async (multiContext: LDMultiKindContext, platform: Platform) => {
  const { kind, ...singleContexts } = multiContext;

  return Promise.all(
    Object.entries(singleContexts).map(([k, c]) =>
      ensureKeyCommon(k, c as LDContextCommon, platform),
    ),
  );
};

export const ensureKeyLegacy = async (c: LDUser, platform: Platform) => {
  await ensureKeyCommon('user', c, platform);
};

export const ensureKey = async (c: LDContext, platform: Platform) => {
  if (isSingleKind(c)) {
    await ensureKeySingle(c, platform);
  }

  if (isMultiKind(c)) {
    await ensureKeyMulti(c, platform);
  }

  if (isLegacyUser(c)) {
    await ensureKeyLegacy(c, platform);
  }
};
