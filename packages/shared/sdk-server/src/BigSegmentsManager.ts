import { Crypto, LDLogger, TypeValidators } from '@launchdarkly/js-sdk-common';

import { LDBigSegmentsOptions } from './api';
import { BigSegmentStore, BigSegmentStoreMembership } from './api/interfaces';
import BigSegmentStoreStatusProviderImpl from './BigSegmentStatusProviderImpl';
import LruCache from './cache/LruCache';

const DEFAULT_STALE_AFTER_SECONDS = 120;
const DEFAULT_STATUS_POLL_INTERVAL_SECONDS = 5;
const DEFAULT_USER_CACHE_SIZE = 1000;
const DEFAULT_USER_CACHE_TIME_SECONDS = 5;

interface MembershipCacheItem {
  membership: BigSegmentStoreMembership | undefined;
}

export default class BigSegmentsManager {
  private _cache: LruCache | undefined;

  private _pollHandle: any;

  private _staleTimeMs: number;

  public readonly statusProvider: BigSegmentStoreStatusProviderImpl;

  constructor(
    private _store: BigSegmentStore | undefined,
    // The store will have been created before the manager is instantiated, so we do not need
    // it in the options at this stage.
    config: Omit<LDBigSegmentsOptions, 'store'>,
    private readonly _logger: LDLogger | undefined,
    private readonly _crypto: Crypto,
  ) {
    this.statusProvider = new BigSegmentStoreStatusProviderImpl(async () =>
      this._pollStoreAndUpdateStatus(),
    );

    this._staleTimeMs =
      (TypeValidators.Number.is(config.staleAfter) && config.staleAfter > 0
        ? config.staleAfter
        : DEFAULT_STALE_AFTER_SECONDS) * 1000;

    const pollIntervalMs =
      (TypeValidators.Number.is(config.statusPollInterval) && config.statusPollInterval > 0
        ? config.statusPollInterval
        : DEFAULT_STATUS_POLL_INTERVAL_SECONDS) * 1000;

    this._pollHandle = _store
      ? setInterval(() => this._pollStoreAndUpdateStatus(), pollIntervalMs)
      : null;

    if (_store) {
      this._cache = new LruCache({
        max: config.userCacheSize || DEFAULT_USER_CACHE_SIZE,
        maxAge: (config.userCacheTime || DEFAULT_USER_CACHE_TIME_SECONDS) * 1000,
      });
    }
  }

  public close() {
    if (this._pollHandle) {
      clearInterval(this._pollHandle);
      this._pollHandle = undefined;
    }
    if (this._store) {
      this._store.close();
    }
  }

  public async getUserMembership(
    userKey: string,
  ): Promise<[BigSegmentStoreMembership | null, string] | undefined> {
    if (!this._store) {
      return undefined;
    }
    const memberCache: MembershipCacheItem | undefined = this._cache?.get(userKey);
    let membership: BigSegmentStoreMembership | undefined;

    if (!memberCache) {
      try {
        membership = await this._store.getUserMembership(this._hashForUserKey(userKey));
        const cacheItem: MembershipCacheItem = { membership };
        this._cache?.set(userKey, cacheItem);
      } catch (err) {
        this._logger?.error(`Big Segment store membership query returned error: ${err}`);
        return [null, 'STORE_ERROR'];
      }
    } else {
      membership = memberCache.membership;
    }

    if (!this.statusProvider.getStatus()) {
      await this._pollStoreAndUpdateStatus();
    }

    // Status will be present, because polling is done earlier in this method if it is not.
    const lastStatus = this.statusProvider.getStatus()!;

    if (!lastStatus.available) {
      return [membership || null, 'STORE_ERROR'];
    }

    return [membership || null, lastStatus.stale ? 'STALE' : 'HEALTHY'];
  }

  private async _pollStoreAndUpdateStatus() {
    if (!this._store) {
      this.statusProvider.setStatus({ available: false, stale: false });
      return;
    }

    this._logger?.debug('Querying Big Segment store status');

    let newStatus;

    try {
      const metadata = await this._store.getMetadata();
      newStatus = {
        available: true,
        stale: !metadata || !metadata.lastUpToDate || this._isStale(metadata.lastUpToDate),
      };
    } catch (err) {
      this._logger?.error(`Big Segment store status query returned error: ${err}`);
      newStatus = { available: false, stale: false };
    }

    const lastStatus = this.statusProvider.getStatus();

    if (
      !lastStatus ||
      lastStatus.available !== newStatus.available ||
      lastStatus.stale !== newStatus.stale
    ) {
      this._logger?.debug(
        'Big Segment store status changed from %s to %s',
        JSON.stringify(lastStatus),
        JSON.stringify(newStatus),
      );
      this.statusProvider.setStatus(newStatus);
      this.statusProvider.notify();
    }
  }

  private _hashForUserKey(userKey: string): string {
    const hasher = this._crypto.createHash('sha256');
    hasher.update(userKey);
    if (!hasher.digest) {
      // This represents an error in platform implementation.
      throw new Error('Platform must implement digest or asyncDigest');
    }
    return hasher.digest('base64');
  }

  private _isStale(timestamp: number) {
    return Date.now() - timestamp >= this._staleTimeMs;
  }
}
