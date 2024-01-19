import { Platform } from '@launchdarkly/js-sdk-common';

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
