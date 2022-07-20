import { LDLogger, TypeValidators } from '@launchdarkly/js-sdk-common';
import { LDBigSegmentsOptions } from './api';
import { BigSegmentStore, BigSegmentStoreStatusProvider } from './api/interfaces';
import BigSegmentStoreStatusProviderImpl from './BigSegmentStatusProviderImpl';
import LruCache from './cache/LruCache';

const DEFAULT_STALE_AFTER_SECONDS = 120;
const DEFAULT_STATUS_POLL_INTERVAL_SECONDS = 5;
const DEFAULT_USER_CACHE_SIZE = 1000;
const DEFAULT_USER_CACHE_TIME_SECONDS = 5;

// TODO: Defensive code for store.

export default class BigSegmentsManager {
  private cache: LruCache | undefined;

  private pollHandle: any;

  private staleTimeMs: number;

  public readonly statusProvider: BigSegmentStoreStatusProvider;

  constructor(
    private store: BigSegmentStore | undefined,
    config: LDBigSegmentsOptions,
    private readonly logger: LDLogger | undefined,
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

    this.pollHandle = store ? setInterval(() => this.pollStoreAndUpdateStatus(), pollIntervalMs) : null;

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

  public async getUserMembership(userKey: string) {

  }

  private async pollStoreAndUpdateStatus() {

  }
}
