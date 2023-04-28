import { EdgeConfigClient } from '@vercel/edge-config';
import type {
  DataKind,
  LDLogger,
  LDFeatureStore,
  LDFeatureStoreDataStorage,
  LDFeatureStoreItem,
  LDFeatureStoreKindData,
} from '@launchdarkly/js-server-sdk-common-edge';
import { deserializePoll, noop } from '@launchdarkly/js-server-sdk-common-edge';

class VercelFeatureStore implements LDFeatureStore {
  private edgeConfig: EdgeConfigClient;

  private configKey: string;

  private logger: LDLogger;

  constructor(edgeConfig: EdgeConfigClient, sdkKey: string, logger: LDLogger) {
    this.edgeConfig = edgeConfig;
    this.configKey = `LD-Env-${sdkKey}`;
    this.logger = logger;
  }

  async get(
    kind: DataKind,
    flagKey: string,
    callback: (res: LDFeatureStoreItem | null) => void
  ): Promise<void> {
    const kindKey = kind.namespace === 'features' ? 'flags' : kind.namespace;
    this.logger.debug(`Requesting ${flagKey} from ${this.configKey}.${kindKey}`);

    try {
      const config = await this.edgeConfig.get(this.configKey);

      if (!config) {
        throw new Error(`${this.configKey} is not found in Edge Config.`);
      }

      // We are serializing/deserialising here as deserializePoll replaces null with undefined (and we do get null values out of the Edge Config which can cause issues).
      // deserializePoll also converts rules, rollouts, buckets and other nested structures into objects which the sdk understands.
      // We have to JSON.stringify the response from edge because they only support returning a json response at this time.
      const item = deserializePoll(JSON.stringify(config));
      if (!item) {
        throw new Error(`Error deserializing ${this.configKey}`);
      }
      callback(item[kindKey][flagKey]);
    } catch (err) {
      this.logger.error(err);
      callback(null);
    }
  }

  async all(kind: DataKind, callback: (res: LDFeatureStoreKindData) => void = noop): Promise<void> {
    const kindKey = kind.namespace === 'features' ? 'flags' : kind.namespace;
    this.logger.debug(`Requesting all from ${this.configKey}.${kindKey}`);
    try {
      const config = await this.edgeConfig.get(this.configKey);
      if (!config) {
        throw new Error(`${this.configKey} is not found in Edge Config.`);
      }

      // We are serializing/deserialising here as deserializePoll replaces null with undefined (and we do get null values out of the Edge Config which can cause issues)
      const item = deserializePoll(JSON.stringify(config));
      if (!item) {
        throw new Error(`Error deserializing ${this.configKey}`);
      }

      callback(item[kindKey]);
    } catch (err) {
      this.logger.error(err);
      callback({});
    }
  }

  async initialized(callback: (isInitialized: boolean) => void = noop): Promise<void> {
    const config = await this.edgeConfig.get(this.configKey);
    const result = config !== null;
    this.logger.debug(`Is ${this.configKey} initialized? ${result}`);
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

export default VercelFeatureStore;
