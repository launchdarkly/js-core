import { Context, Crypto, LDLogger, Storage } from '@launchdarkly/js-sdk-common';

import { Flag, Flags } from '../types';
import { namespaceForContextData } from './namespaceUtils';

function isValidFlag(value: unknown): value is Flag {
  return value !== null && typeof value === 'object' && typeof (value as Flag).version === 'number';
}

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
    const parsed = JSON.parse(flagsJson);
    if (parsed === null || typeof parsed !== 'object') {
      logger?.warn('Cached flag data is not a valid object');
      return undefined;
    }

    const entries = Object.entries(parsed);
    const invalidKey = entries.find(([, value]) => !isValidFlag(value));
    if (invalidKey) {
      logger?.warn(`Discarding cached flags due to invalid entry: ${invalidKey[0]}`);
      return undefined;
    }

    const flags: Flags = entries.reduce((acc: Flags, [key, value]) => {
      acc[key] = value as Flag;
      return acc;
    }, {});

    return { flags, storageKey, fromLegacyKey };
  } catch (e: any) {
    logger?.warn(`Could not parse cached flag evaluations from persistent storage: ${e.message}`);
    return undefined;
  }
}
