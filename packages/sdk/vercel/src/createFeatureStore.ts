import { EdgeConfigClient } from '@vercel/edge-config';
import type {
  DataKind,
  LDLogger,
  LDFeatureStore,
  LDFeatureStoreDataStorage,
  LDFeatureStoreItem,
  LDFeatureStoreKindData
} from '@launchdarkly/js-server-sdk-common-edge';
import { noop } from '@launchdarkly/js-server-sdk-common-edge';

class VercelFeatureStore implements LDFeatureStore {
  private edgeConfig: EdgeConfigClient
  private configKey: string
  private logger: LDLogger

  constructor (edgeConfig: EdgeConfigClient, sdkKey: string, logger: LDLogger) {
    this.edgeConfig = edgeConfig
    this.configKey = `LD-Env-${sdkKey}`;
    this.logger = logger
  }
  
  get(kind: DataKind, flagKey: string, callback: (res: LDFeatureStoreItem | null) => void): void {
    this.logger.debug(`Requesting ${flagKey} from ${this.configKey}`);
    this.edgeConfig
      .get(this.configKey)
      .then((i) => {
        if (i === null) {
          this.logger.error('Feature data not found in Edge Config.');
        }
        const kindKey = kind.namespace === 'features' ? 'flags' : kind.namespace;
        const item = i as LDFeatureStoreItem;
        callback(item[kindKey][flagKey]);
      })
      .catch((err) => {
        this.logger.error(err);
        callback(null);
      });
  }
  all(kind: DataKind, callback: (res: LDFeatureStoreKindData) => void = noop): void {
    const kindKey = kind.namespace === 'features' ? 'flags' : kind.namespace;
    this.logger.debug(`Requesting all ${kindKey} data from Edge Config.`);
    this.edgeConfig
      .get(this.configKey)
      .then((i) => {
        if (i === null) {
          this.logger.error('Feature data not found in Edge Config.');
        }
        const item = i as LDFeatureStoreItem;
        callback(item[kindKey]);
      })
      .catch((err) => {
        this.logger.error(err);
        callback({});
      });
  }
  initialized(callback: (isInitialized: boolean) => void = noop): void {
    this.edgeConfig.get(this.configKey).then((item) => {
      const result = item !== null;
      this.logger.debug(`Is ${this.configKey} initialized? ${result}`);
      callback(result);
    });
  }
  init(allData: LDFeatureStoreDataStorage, callback: () => void): void {
    callback();
  }
  getDescription(): string {
    return 'Vercel Edge Config';
  }

  // unused
  close = noop
  delete = noop
  upsert = noop
}

export default VercelFeatureStore;
