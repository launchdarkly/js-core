import { Platform } from '@launchdarkly/js-sdk-common';

import { concatNamespacesAndValues, Namespace } from './namespaceUtils';

export const getOrGenerateKey = async (
  storageKey: string,
  { crypto, storage }: Platform,
) => {
  let contextKey = await storage?.get(storageKey);

  if (!contextKey) {
    contextKey = crypto.randomUUID();
    await storage?.set(storageKey, contextKey);
  }

  return contextKey;
};
