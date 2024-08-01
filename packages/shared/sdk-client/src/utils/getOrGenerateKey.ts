import { Platform } from '@launchdarkly/js-sdk-common';

import { concatNamespacesAndValues, Namespace } from './namespaceUtils';

export const getOrGenerateKey = async (
  storageKey: string,
  { crypto, storage }: Platform,
) => {
  let generatedKey = await storage?.get(storageKey);

  if (!generatedKey) {
    generatedKey = crypto.randomUUID();
    await storage?.set(storageKey, generatedKey);
  }

  return generatedKey;
};
