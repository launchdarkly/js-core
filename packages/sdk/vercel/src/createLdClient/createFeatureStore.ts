import { EdgeConfigClient } from '@vercel/edge-config';
import type {
  DataKind,
  LDLogger,
  LDFeatureStore,
  LDFeatureStoreDataStorage,
  LDFeatureStoreItem,
  LDFeatureStoreKindData,
} from '@launchdarkly/js-server-sdk-common';
import noop from '../utils/noop';

const createFeatureStore = (edgeConfig: EdgeConfigClient, sdkKey: string, logger: LDLogger) => {
  const key = `LD-Env-${sdkKey}`;
  const store: LDFeatureStore = {
    get(
      kind: DataKind,
      flagKey: string,
      callback: (res: LDFeatureStoreItem | null) => void = noop
    ): void {
      logger.debug(`Requesting ${flagKey} from ${key}`);
      edgeConfig
        .get(key)
        .then((i) => {
          if (i === null) {
            logger.error('Feature data not found in Edge Config.');
          }
          const kindKey = kind.namespace === 'features' ? 'flags' : kind.namespace;
          const item = i as LDFeatureStoreItem;
          callback(item[kindKey][flagKey]);
        })
        .catch((err) => {
          logger.error(err);
          callback(null);
        });
    },
    all(kind: DataKind, callback: (res: LDFeatureStoreKindData) => void = noop): void {
      const kindKey = kind.namespace === 'features' ? 'flags' : kind.namespace;
      logger.debug(`Requesting all ${kindKey} data from Edge Config.`);
      edgeConfig
        .get(key)
        .then((i) => {
          if (i === null) {
            logger.error('Feature data not found in Edge Config.');
          }
          const item = i as LDFeatureStoreItem;
          callback(item[kindKey]);
        })
        .catch((err) => {
          logger.error(err);
          callback({});
        });
    },
    initialized(callback: (isInitialized: boolean) => void = noop): void {
      edgeConfig.get(key).then((item) => {
        const result = item !== null;
        logger.debug(`Is ${key} initialized? ${result}`);
        callback(result);
      });
    },
    init(allData: LDFeatureStoreDataStorage, callback: () => void): void {
      callback();
    },
    getDescription(): string {
      return 'Vercel Edge Config';
    },

    // unused
    close: noop,
    delete: noop,
    upsert: noop,
  };

  return store;
};

export default createFeatureStore;
