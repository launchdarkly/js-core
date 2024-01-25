import { Platform } from '@launchdarkly/js-sdk-common';

export const addNamespace = (s: string) => `LaunchDarkly_AnonKeys_${s}`;

export const getOrGenerateKey = async (kind: string, { crypto, storage }: Platform) => {
  const namespacedKind = addNamespace(kind);
  let contextKey = await storage?.get(namespacedKind);

  if (!contextKey) {
    contextKey = crypto.randomUUID();
    await storage?.set(namespacedKind, contextKey);
  }

  return contextKey;
};
