import { LDLogger, TypeValidators } from '@launchdarkly/js-sdk-common';
import { LDBigSegmentsOptions } from './api';
import { BigSegmentStore, BigSegmentStoreMembership } from './api/interfaces';
import BigSegmentStoreStatusProviderImpl from './BigSegmentStatusProviderImpl';
import LruCache from './cache/LruCache';
import { Crypto } from './platform';

const DEFAULT_STALE_AFTER_SECONDS = 120;
const DEFAULT_STATUS_POLL_INTERVAL_SECONDS = 5;
const DEFAULT_USER_CACHE_SIZE = 1000;
const DEFAULT_USER_CACHE_TIME_SECONDS = 5;

// TODO: Do we need defensive code for store and big segment configuration?

export default class BigSegmentsManager {
  private cache: LruCache | undefined;

  private pollHandle: any;

  private staleTimeMs: number;

  public readonly statusProvider: BigSegmentStoreStatusProviderImpl;

  constructor(
    private store: BigSegmentStore | undefined,
    config: LDBigSegmentsOptions,
    private readonly logger: LDLogger | undefined,
    private readonly crypto: Crypto,
  ) {
    this.statusProvider = new BigSegmentStoreStatusProviderImpl(
      async () => this.pollStoreAndUpdateStatus(),
    );

    this.staleTimeMs = (TypeValidators.Number.is(config.staleAfter)
      && config.staleAfter > 0
      ? config.staleAfter
      : DEFAULT_STALE_AFTER_SECONDS) * 1000;

    const pollIntervalMs = (TypeValidators.Number.is(config.statusPollInterval)
      && config.statusPollInterval > 0
      ? config.statusPollInterval
      : DEFAULT_STATUS_POLL_INTERVAL_SECONDS) * 1000;

    this.pollHandle = store
      ? setInterval(() => this.pollStoreAndUpdateStatus(), pollIntervalMs)
      : null;

    if (store) {
      this.cache = new LruCache({
        max: config.userCacheSize || DEFAULT_USER_CACHE_SIZE,
        maxAge: (config.userCacheTime || DEFAULT_USER_CACHE_TIME_SECONDS) * 1000,
      });
    }
  }

  public close() {
    if (this.pollHandle) {
      clearInterval(this.pollHandle);
      this.pollHandle = undefined;
    }
    if (this.store) {
      this.store.close();
    }
  }

  public async getUserMembership(userKey: string):
  Promise<[BigSegmentStoreMembership | null, string] | undefined> {
    if (!this.store) {
      return undefined;
    }
    let membership = this.cache?.get(userKey);
    if (!membership) {
      try {
        membership = await this.store.getUserMembership(this.hashForUserKey(userKey));
        this.cache?.set(userKey, membership);
      } catch (err) {
        this.logger?.error(`Big Segment store membership query returned error: ${err}`);
        return [null, 'STORE_ERROR'];
      }
    }

    if (!this.statusProvider.getStatus()) {
      await this.pollStoreAndUpdateStatus();
    }

    // Status will be present, because polling is done earlier in this method if it is not.
    const lastStatus = this.statusProvider.getStatus()!;

    if (!lastStatus.available) {
      return [membership, 'STORE_ERROR'];
    }

    return [membership, lastStatus.stale ? 'STALE' : 'HEALTHY'];
  }

  private async pollStoreAndUpdateStatus() {
    if (!this.store) {
      this.statusProvider.setStatus({ available: false, stale: false });
      return;
    }

    this.logger?.debug('Querying Big Segment store status');

    let newStatus;

    try {
      const metadata = await this.store.getMetadata();
      newStatus = {
        available: true,
        stale: !metadata || !metadata.lastUpToDate || this.isStale(metadata.lastUpToDate),
      };
    } catch (err) {
      this.logger?.error(`Big Segment store status query returned error: ${err}`);
      newStatus = { available: false, stale: false };
    }

    const lastStatus = this.statusProvider.getStatus();

    if (
      !lastStatus
      || lastStatus.available !== newStatus.available
      || lastStatus.stale !== newStatus.stale) {
      this.logger?.debug(
        'Big Segment store status changed from %s to %s',
        JSON.stringify(lastStatus),
        JSON.stringify(newStatus),
      );
      this.statusProvider.setStatus(newStatus);
      this.statusProvider.notify();
    }
  }

  private hashForUserKey(userKey: string): string {
    const hasher = this.crypto.createHash('sha256');
    hasher.update(userKey);
    return hasher.digest('base64');
  }

  private isStale(timestamp: number) {
    return Date.now() - timestamp >= this.staleTimeMs;
  }
}
