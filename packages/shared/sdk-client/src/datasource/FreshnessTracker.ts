import { Context, Crypto, Storage } from '@launchdarkly/js-sdk-common';

import digest from '../crypto/digest';
import { namespaceForContextData } from '../storage/namespaceUtils';

/**
 * Suffix appended to context storage keys to form the freshness storage key.
 * Used by both {@link FreshnessTracker} and {@link FlagPersistence} (for
 * cleanup during context eviction).
 */
export const FRESHNESS_KEY_SUFFIX = '_freshness';

/**
 * Stored freshness record. Includes the timestamp and a hash of the full
 * context attributes so that attribute changes for the same context key
 * correctly invalidate freshness.
 */
interface FreshnessRecord {
  /** Timestamp in ms since epoch when data was last received. */
  timestamp: number;
  /** SHA-256 hash of the full context's canonical JSON. */
  contextHash: string;
}

/**
 * Tracks when flag data was last received for a given context.
 *
 * Freshness is persisted to storage alongside cached flag data using a
 * separate storage key (`{contextKey}_freshness`).
 *
 * The stored record includes a hash of the full context attributes (not just
 * the context key). When a context's attributes change — even if the key is
 * the same — the hash will differ and the freshness is treated as stale,
 * forcing an immediate poll (per Req 5.2.1).
 *
 * The polling synchronizer uses freshness to schedule its next poll relative
 * to when data was last received, rather than relative to the current time.
 * This prevents unnecessary polls when switching between connection modes.
 */
export interface FreshnessTracker {
  /**
   * Returns the timestamp (ms since epoch) when data was last received
   * for the given context, or `undefined` if no freshness data exists or
   * the stored context attributes don't match the current context.
   */
  getFreshness(context: Context): Promise<number | undefined>;

  /**
   * Records that data was just received for the given context.
   * Persists the current time and the context's attribute hash to storage.
   *
   * Should be called on:
   * - Payload receipt (full or partial)
   * - `transfer-none` intent (server confirms data is current)
   */
  recordFreshness(context: Context): Promise<void>;

  /**
   * Calculates how long to wait before the next poll, based on when
   * data was last received.
   *
   * - If no freshness data exists (or attributes changed), returns 0
   *   (poll immediately per Req 5.2.4).
   * - If fresh enough, returns the remaining time until the poll interval elapses.
   *
   * Formula: `max(0, pollIntervalMs - (now - lastFreshness))`
   */
  getNextPollDelayMs(context: Context, pollIntervalMs: number): Promise<number>;
}

async function freshnessKey(
  crypto: Crypto,
  environmentNamespace: string,
  context: Context,
): Promise<string> {
  const contextKey = await namespaceForContextData(crypto, environmentNamespace, context);
  return `${contextKey}${FRESHNESS_KEY_SUFFIX}`;
}

/**
 * Computes a SHA-256 hash of the context's full canonical JSON.
 * This captures all attributes, not just the key.
 */
async function hashContext(crypto: Crypto, context: Context): Promise<string> {
  const json = context.canonicalUnfilteredJson();
  if (!json) {
    return '';
  }
  return digest(crypto.createHash('sha256').update(json), 'base64');
}

/**
 * Creates a {@link FreshnessTracker}.
 *
 * @param storage Platform storage for persisting freshness.
 * @param crypto Platform crypto for computing storage keys and context hashes.
 * @param environmentNamespace Hashed environment namespace.
 * @param timeStamper Optional time function (defaults to `Date.now`; injectable for testing).
 *
 * @internal
 */
export function createFreshnessTracker(
  storage: Storage | undefined,
  crypto: Crypto,
  environmentNamespace: string,
  timeStamper: () => number = () => Date.now(),
): FreshnessTracker {
  return {
    async getFreshness(context: Context): Promise<number | undefined> {
      if (!storage) {
        return undefined;
      }

      const key = await freshnessKey(crypto, environmentNamespace, context);
      const value = await storage.get(key);
      if (value === null || value === undefined) {
        return undefined;
      }

      try {
        const record: FreshnessRecord = JSON.parse(value);
        const currentHash = await hashContext(crypto, context);
        if (record.contextHash !== currentHash) {
          // Context attributes changed — treat as stale.
          return undefined;
        }
        return typeof record.timestamp === 'number' && !Number.isNaN(record.timestamp)
          ? record.timestamp
          : undefined;
      } catch {
        // Corrupt or old-format data — treat as stale.
        return undefined;
      }
    },

    async recordFreshness(context: Context): Promise<void> {
      if (!storage) {
        return;
      }

      const key = await freshnessKey(crypto, environmentNamespace, context);
      const record: FreshnessRecord = {
        timestamp: timeStamper(),
        contextHash: await hashContext(crypto, context),
      };
      await storage.set(key, JSON.stringify(record));
    },

    async getNextPollDelayMs(context: Context, pollIntervalMs: number): Promise<number> {
      const freshness = await this.getFreshness(context);
      if (freshness === undefined) {
        return 0;
      }

      const elapsed = timeStamper() - freshness;
      return Math.max(0, pollIntervalMs - elapsed);
    },
  };
}
