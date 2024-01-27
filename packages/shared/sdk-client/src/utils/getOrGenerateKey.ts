import { Platform } from '@launchdarkly/js-sdk-common';

export type Namespace = 'anonymous' | 'context';

export const prefixNamespace = (namespace: Namespace, s: string) => {
  let n: string;

  switch (namespace) {
    case 'anonymous':
      n = 'LaunchDarkly_AnonymousKeys_';
      break;
    case 'context':
      n = 'LaunchDarkly_ContextKeys_';
      break;
    default:
      throw new Error(
        `Unsupported namespace ${namespace}. Only 'anonymous' or 'context' are supported.`,
      );
  }

  return `${n}${s}`;
};

export const getOrGenerateKey = async (
  namespace: Namespace,
  contextKind: string,
  { crypto, storage }: Platform,
) => {
  const storageKey = prefixNamespace(namespace, contextKind);
  let contextKey = await storage?.get(storageKey);

  if (!contextKey) {
    contextKey = crypto.randomUUID();
    await storage?.set(storageKey, contextKey);
  }

  return contextKey;
};
