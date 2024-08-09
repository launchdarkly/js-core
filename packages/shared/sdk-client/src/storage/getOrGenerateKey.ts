import { Platform } from '@launchdarkly/js-sdk-common';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { namespaceForGeneratedContextKey } from './namespaceUtils';

/**
 * This function will retrieve a previously generated key for the given {@link storageKey} if it
 * exists or generate and store one on the fly if it does not already exist.
 * @param storageKey keyed storage location where the generated key should live.  See {@link namespaceForGeneratedContextKey}
 * for related exmaples of generating a storage key and usage.
 * @param platform crypto and storage implementations for necessary operations
 * @returns the generated key
 */
export const getOrGenerateKey = async (storageKey: string, { crypto, storage }: Platform) => {
  let generatedKey = await storage?.get(storageKey);

  if (!generatedKey) {
    generatedKey = crypto.randomUUID();
    await storage?.set(storageKey, generatedKey);
  }

  return generatedKey;
};
