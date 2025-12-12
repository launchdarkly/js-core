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

import { getOrGenerateKey } from '../storage/getOrGenerateKey';
import { namespaceForGeneratedContextKey } from '../storage/namespaceUtils';

const { isLegacyUser, isMultiKind, isSingleKind } = internal;

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
    const storageKey = await namespaceForGeneratedContextKey(kind);
    // This mutates a cloned copy of the original context from ensureyKey so this is safe.
    // eslint-disable-next-line no-param-reassign
    c.key = await getOrGenerateKey(storageKey, platform);
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

/**
 * Ensure a key is always present in anonymous contexts. Non-anonymous contexts
 * are not processed and will just be returned as is.
 *
 * @param context
 * @param platform
 */
export const ensureKey = async (context: LDContext, platform: Platform): Promise<LDContext> => {
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
