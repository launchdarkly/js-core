import { Platform } from '@launchdarkly/js-sdk-common';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { namespaceForGeneratedContextKey } from './namespaceUtils';

/**
 * This function will retrieve a previously generated key for the given {@link storageKey} if it
 * exists or generate and store one on the fly if it does not already exist.
 * @param storageKey keyed storage location where the generated key should live.  See {@link namespaceForGeneratedContextKey}
 * for related exmaples of generating a storage key and usage.
 * @param platform crypto and storage implementations for necessary operations
 * @param legacyStorageKey optional legacy storage key to migrate from. If the key is not found
 * under {@link storageKey} but exists under this legacy key, it will be migrated to the new
 * location and the legacy key will be cleared.
 * @returns the generated key
 */
export const getOrGenerateKey = async (
  storageKey: string,
  { crypto, storage }: Platform,
  legacyStorageKey?: string,
) => {
  let generatedKey = await storage?.get(storageKey);

  if (generatedKey == null) {
    if (legacyStorageKey) {
      generatedKey = await storage?.get(legacyStorageKey);
      if (generatedKey != null) {
        await storage?.set(storageKey, generatedKey);
        const verified = await storage?.get(storageKey);
        if (verified != null) {
          await storage?.clear(legacyStorageKey);
        }
      }
    }

    if (generatedKey == null) {
      generatedKey = crypto.randomUUID();
      await storage?.set(storageKey, generatedKey);
    }
  }

  return generatedKey;
};
