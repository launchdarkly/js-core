import { KVNamespace } from '@cloudflare/workers-types';
import type {
  DataKind,
  LDLogger,
  LDFeatureStore,
  LDFeatureStoreDataStorage,
  LDFeatureStoreItem,
  LDFeatureStoreKindData,
} from '@launchdarkly/js-server-sdk-common';

const noop = () => {};

const createFeatureStore = (kvNamespace: KVNamespace, sdkKey: string, logger: LDLogger) => {
  const key = `LD-Env-${sdkKey}`;
  const store: LDFeatureStore = {
    get(
      kind: DataKind,
      flagKey: string,
      callback: (res: LDFeatureStoreItem | null) => void = noop
    ): void {
      logger.debug(`Requesting ${flagKey} from ${key}`);
      kvNamespace
        .get(key, { type: 'json' })
        .then((i) => {
          if (i === null) {
            logger.error('Feature data not found in KV.');
          }
          const kindKey = kind.namespace === 'features' ? 'flags' : kind.namespace;
          const item = i as LDFeatureStoreItem;
          callback(item[kindKey][flagKey]);
        })
        .catch((err) => {
          logger.error(err);
        });
    },
    all(kind: DataKind, callback: (res: LDFeatureStoreKindData) => void = noop): void {
      const kindKey = kind.namespace === 'features' ? 'flags' : kind.namespace;
      logger.debug(`Requesting all ${kindKey} data from KV.`);
      kvNamespace
        .get(key, { type: 'json' })
        .then((i) => {
          if (i === null) {
            logger.error('Feature data not found in KV.');
          }
          const item = i as LDFeatureStoreItem;
          callback(item[kindKey]);
        })
        .catch((err) => {
          logger.error(err);
        });
    },
    initialized(callback: (isInitialized: boolean) => void = noop): void {
      kvNamespace.get(key).then((item) => {
        const result = item !== null;
        logger.debug(`Is ${key} initialized? ${result}`);
        callback(result);
      });
    },
    init(allData: LDFeatureStoreDataStorage, callback: () => void): void {
      callback();
    },
    getDescription(): string {
      return 'Cloudflare';
    },

    // unused
    close: noop,
    delete: noop,
    upsert: noop,
  };

  return store;
};

export default createFeatureStore;
