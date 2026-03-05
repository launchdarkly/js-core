import { Context, Crypto, LDLogger, Storage } from '@launchdarkly/js-sdk-common';

import { Flags } from '../types';
import { namespaceForContextData } from './namespaceUtils';

/**
 * Result of loading cached flags from storage.
 */
export interface CachedFlagData {
  /** The parsed flag data. */
  flags: Flags;
  /** The storage key where the flags were found (or should be stored). */
  storageKey: string;
  /** Whether the flags were found at the legacy canonical key location. */
  fromLegacyKey: boolean;
}

/**
 * Loads cached flag data from storage for the given context.
 *
 * Checks the current storage key first, then falls back to the legacy
 * canonical key location (pre-10.3.1). Does NOT perform migration — the
 * caller is responsible for migrating data if {@link CachedFlagData.fromLegacyKey}
 * is true.
 *
 * @returns The cached flag data, or `undefined` on cache miss or parse error.
 */
export async function loadCachedFlags(
  storage: Storage,
  crypto: Crypto,
  environmentNamespace: string,
  context: Context,
  logger?: LDLogger,
): Promise<CachedFlagData | undefined> {
  const storageKey = await namespaceForContextData(crypto, environmentNamespace, context);
  let flagsJson = await storage.get(storageKey);
  let fromLegacyKey = false;

  if (flagsJson === null || flagsJson === undefined) {
    // Fallback: in version <10.3.1 flag data was stored under the canonical key.
    flagsJson = await storage.get(context.canonicalKey);
    if (flagsJson === null || flagsJson === undefined) {
      return undefined;
    }
    fromLegacyKey = true;
  }

  try {
    const flags: Flags = JSON.parse(flagsJson);
    return { flags, storageKey, fromLegacyKey };
  } catch (e: any) {
    logger?.warn(`Could not parse cached flag evaluations from persistent storage: ${e.message}`);
    return undefined;
  }
}
