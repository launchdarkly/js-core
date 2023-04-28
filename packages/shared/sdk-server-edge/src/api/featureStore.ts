import {
  DataKind,
  deserializePoll,
  LDFeatureStore,
  LDFeatureStoreDataStorage,
  LDFeatureStoreItem,
  LDFeatureStoreKindData,
  LDLogger,
  noop,
} from '@launchdarkly/js-server-sdk-common';

class EdgeFeatureStore<S> implements LDFeatureStore {
  private store: S;

  private rootKey: string;

  private logger: LDLogger;

  constructor(store: S, sdkKey: string, logger: LDLogger) {
    this.store = store;
    this.rootKey = `LD-Env-${sdkKey}`;
    this.logger = logger;
  }

  async get(
    kind: DataKind,
    flagKey: string,
    callback: (res: LDFeatureStoreItem | null) => void
  ): Promise<void> {
    const kindKey = kind.namespace === 'features' ? 'flags' : kind.namespace;
    this.logger.debug(`Requesting ${flagKey} from ${this.rootKey}.${kindKey}`);

    try {
      const config = await this.store.get(this.rootKey);

      if (!config) {
        throw new Error(`${this.rootKey} is not found in Edge Config.`);
      }

      // We are serializing/deserialising here as deserializePoll replaces null with undefined (and we do get null values out of the Edge Config which can cause issues).
      // deserializePoll also converts rules, rollouts, buckets and other nested structures into objects which the sdk understands.
      // We have to JSON.stringify the response from edge because they only support returning a json response at this time.
      const item = deserializePoll(JSON.stringify(config));
      if (!item) {
        throw new Error(`Error deserializing ${this.rootKey}`);
      }
      callback(item[kindKey][flagKey]);
    } catch (err) {
      this.logger.error(err);
      callback(null);
    }
  }

  async all(kind: DataKind, callback: (res: LDFeatureStoreKindData) => void = noop): Promise<void> {
    const kindKey = kind.namespace === 'features' ? 'flags' : kind.namespace;
    this.logger.debug(`Requesting all from ${this.rootKey}.${kindKey}`);
    try {
      const config = await this.store.get(this.rootKey);
      if (!config) {
        throw new Error(`${this.rootKey} is not found in Edge Config.`);
      }

      // We are serializing/deserialising here as deserializePoll replaces null with undefined (and we do get null values out of the Edge Config which can cause issues)
      const item = deserializePoll(JSON.stringify(config));
      if (!item) {
        throw new Error(`Error deserializing ${this.rootKey}`);
      }

      callback(item[kindKey]);
    } catch (err) {
      this.logger.error(err);
      callback({});
    }
  }

  async initialized(callback: (isInitialized: boolean) => void = noop): Promise<void> {
    const config = await this.store.get(this.rootKey);
    const result = config !== null;
    this.logger.debug(`Is ${this.rootKey} initialized? ${result}`);
    callback(result);
  }

  init(allData: LDFeatureStoreDataStorage, callback: () => void): void {
    callback();
  }

  getDescription(): string {
    return 'Vercel Edge Config';
  }

  // unused
  close = noop;

  delete = noop;

  upsert = noop;
}

export default EdgeFeatureStore;
