import { Context, Crypto, Storage } from '@launchdarkly/js-sdk-common';

import { namespaceForContextData } from '../storage/namespaceUtils';

/**
 * Suffix appended to context storage keys to form the freshness storage key.
 * Used by both {@link FreshnessTracker} and {@link FlagPersistence} (for
 * cleanup during context eviction).
 */
export const FRESHNESS_KEY_SUFFIX = '_freshness';

/**
 * Tracks when flag data was last received for a given context.
 *
 * Freshness is persisted to storage alongside cached flag data using a
 * separate storage key (`{contextKey}_freshness`).
 *
 * The polling synchronizer uses freshness to schedule its next poll relative
 * to when data was last received, rather than relative to the current time.
 * This prevents unnecessary polls when switching between connection modes.
 */
export interface FreshnessTracker {
  /**
   * Returns the timestamp (ms since epoch) when data was last received
   * for the given context, or `undefined` if no freshness data exists.
   */
  getFreshness(context: Context): Promise<number | undefined>;

  /**
   * Records that data was just received for the given context.
   * Persists the current time to storage.
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
   * - If no freshness data exists, returns 0 (poll immediately per Req 5.2.4).
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
 * Creates a {@link FreshnessTracker}.
 *
 * @param storage Platform storage for persisting freshness.
 * @param crypto Platform crypto for computing storage keys.
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

      const parsed = Number(value);
      return Number.isNaN(parsed) ? undefined : parsed;
    },

    async recordFreshness(context: Context): Promise<void> {
      if (!storage) {
        return;
      }

      const key = await freshnessKey(crypto, environmentNamespace, context);
      await storage.set(key, String(timeStamper()));
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
