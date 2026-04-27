import { Context, Crypto, LDLogger, Storage } from '@launchdarkly/js-sdk-common';

import digest from '../crypto/digest';
import { namespaceForContextData } from './namespaceUtils';

/**
 * Suffix appended to context storage keys to form the freshness storage key.
 */
export const FRESHNESS_SUFFIX = '_freshness';

/**
 * Persisted freshness record stored at `{contextStorageKey}_freshness`.
 */
export interface FreshnessRecord {
  /** Timestamp in ms since epoch when data was last received. */
  timestamp: number;
  /** SHA-256 hash of the full context's canonical JSON. */
  contextHash: string;
}

/**
 * Computes a SHA-256 hash of the context's full canonical JSON.
 * Returns `undefined` if the context cannot be serialized.
 */
export async function hashContext(crypto: Crypto, context: Context): Promise<string | undefined> {
  const json = context.canonicalUnfilteredJson();
  if (!json) {
    return undefined;
  }
  return digest(crypto.createHash('sha256').update(json), 'base64');
}

/**
 * Reads the freshness timestamp from storage for the given context.
 *
 * Returns `undefined` if no freshness record exists, the data is corrupt,
 * or the context attributes have changed since the freshness was recorded.
 */
export async function readFreshness(
  storage: Storage,
  crypto: Crypto,
  environmentNamespace: string,
  context: Context,
  logger?: LDLogger,
): Promise<number | undefined> {
  const contextStorageKey = await namespaceForContextData(crypto, environmentNamespace, context);
  const json = await storage.get(`${contextStorageKey}${FRESHNESS_SUFFIX}`);
  if (json === null || json === undefined) {
    return undefined;
  }

  try {
    const record: FreshnessRecord = JSON.parse(json);
    const currentHash = await hashContext(crypto, context);
    if (currentHash === undefined || record.contextHash !== currentHash) {
      return undefined;
    }
    return typeof record.timestamp === 'number' && !Number.isNaN(record.timestamp) ?
      record.timestamp :
      undefined;
  } catch (e: any) {
    logger?.warn(`Could not read freshness data from persistent storage: ${e.message}`);
    return undefined;
  }
}
