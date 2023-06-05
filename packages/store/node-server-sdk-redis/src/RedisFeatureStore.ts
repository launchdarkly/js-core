import {
  interfaces,
  LDFeatureStore,
  LDFeatureStoreDataStorage,
  LDFeatureStoreItem,
  LDFeatureStoreKindData,
  LDKeyedFeatureStoreItem,
  LDLogger,
  PersistentDataStoreWrapper,
} from '@launchdarkly/node-server-sdk';
import Redis from 'ioredis';
import LDRedisOptions from './LDRedisOptions';
import RedisCore from './RedisCore';
import RedisClientState from './RedisClientState';

/**
 * The default TTL cache time in seconds.
 */
const DEFAULT_CACHE_TTL_S = 30;

const DEFAULT_PREFIX = 'launchdarkly';

function ClientFromOptions(options?: LDRedisOptions): RedisClientState {
  // If a pre-configured client is provided, then use it.
  if (options?.client) {
    return new RedisClientState(options!.client, false);
  }
  // If there are options for redis, then make a client using those options.
  if (options?.redisOpts) {
    return new RedisClientState(new Redis(options!.redisOpts), true);
  }
  // There was no client, and there were no options.
  return new RedisClientState(new Redis(), true);
}

function TtlFromOptions(options?: LDRedisOptions): number {
  // 0 is a valid option. So we need a null/undefined check.
  if (options?.cacheTTL === undefined || options.cacheTTL === null) {
    return DEFAULT_CACHE_TTL_S;
  }
  return options!.cacheTTL;
}

/**
 * Integration between the LaunchDarkly SDK and Redis.
 */
export default class RedisFeatureStore implements LDFeatureStore {
  private wrapper: PersistentDataStoreWrapper;

  constructor(options?: LDRedisOptions, private readonly logger?: LDLogger) {
    this.wrapper = new PersistentDataStoreWrapper(
      new RedisCore(ClientFromOptions(options), options?.prefix || DEFAULT_PREFIX, logger),
      TtlFromOptions(options)
    );
  }

  get(
    kind: interfaces.DataKind,
    key: string,
    callback: (res: LDFeatureStoreItem | null) => void
  ): void {
    this.wrapper.get(kind, key, callback);
  }

  all(kind: interfaces.DataKind, callback: (res: LDFeatureStoreKindData) => void): void {
    this.wrapper.all(kind, callback);
  }

  init(allData: LDFeatureStoreDataStorage, callback: () => void): void {
    this.wrapper.init(allData, callback);
  }

  delete(kind: interfaces.DataKind, key: string, version: number, callback: () => void): void {
    this.wrapper.delete(kind, key, version, callback);
  }

  upsert(kind: interfaces.DataKind, data: LDKeyedFeatureStoreItem, callback: () => void): void {
    this.wrapper.upsert(kind, data, callback);
  }

  initialized(callback: (isInitialized: boolean) => void): void {
    this.wrapper.initialized(callback);
  }

  close(): void {
    this.wrapper.close();
  }

  getDescription?(): string {
    return this.wrapper.getDescription();
  }
}
