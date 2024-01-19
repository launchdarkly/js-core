import {
  clone,
  internal,
  LDContext,
  LDContextCommon,
  LDMultiKindContext,
  LDSingleKindContext,
  LDUser,
  Platform,
} from '@launchdarkly/js-sdk-common';

const { isLegacyUser, isMultiKind, isSingleKind } = internal;

export const addNamespace = (s: string) => `LaunchDarkly_AnonKeys_${s}`;

export const getOrGenerateKey = async (kind: string, { crypto, storage }: Platform) => {
  const nsKind = addNamespace(kind);
  let contextKey = await storage?.get(nsKind);

  if (!contextKey) {
    contextKey = crypto.randomUUID();
    await storage?.set(nsKind, contextKey);
  }

  return contextKey;
};

/**
 * This is the root ensureKey function. All other ensureKey functions reduce to this.
 *
 * - ensureKeyCommon // private root function
 *  - ensureKeySingle
 *  - ensureKeyMulti
 *  - ensureKeyLegacy
 *    - ensureKey // exported for external use
 *
 * @param kind The LDContext kind
 * @param c The LDContext object
 * @param platform Platform containing crypto and storage needed for storing and querying keys.
 */
const ensureKeyCommon = async (kind: string, c: LDContextCommon, platform: Platform) => {
  const { anonymous, key } = c;

  if (anonymous && !key) {
    // This mutates a cloned copy of the original context from ensureyKey so this is safe.
    // eslint-disable-next-line no-param-reassign
    c.key = await getOrGenerateKey(kind, platform);
  }
};

const ensureKeySingle = async (c: LDSingleKindContext, platform: Platform) => {
  await ensureKeyCommon(c.kind, c, platform);
};

const ensureKeyMulti = async (multiContext: LDMultiKindContext, platform: Platform) => {
  const { kind, ...singleContexts } = multiContext;

  return Promise.all(
    Object.entries(singleContexts).map(([k, c]) =>
      ensureKeyCommon(k, c as LDContextCommon, platform),
    ),
  );
};

const ensureKeyLegacy = async (c: LDUser, platform: Platform) => {
  await ensureKeyCommon('user', c, platform);
};

const ensureKey = async (context: LDContext, platform: Platform) => {
  const cloned = clone<LDContext>(context);

  if (isSingleKind(cloned)) {
    await ensureKeySingle(cloned as LDSingleKindContext, platform);
  }

  if (isMultiKind(cloned)) {
    await ensureKeyMulti(cloned as LDMultiKindContext, platform);
  }

  if (isLegacyUser(cloned)) {
    await ensureKeyLegacy(cloned as LDUser, platform);
  }

  return cloned;
};

export default ensureKey;
