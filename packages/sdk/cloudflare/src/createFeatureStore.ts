import type { KVNamespace } from '@cloudflare/workers-types';
import {
  DataKind,
  LDLogger,
  LDFeatureStore,
  LDFeatureStoreDataStorage,
  LDFeatureStoreItem,
  LDFeatureStoreKindData,
  noop,
  deserializePoll,
} from '@launchdarkly/js-server-sdk-common-edge';

const createFeatureStore = (kvNamespace: KVNamespace, sdkKey: string, logger: LDLogger) => {
  const key = `LD-Env-${sdkKey}`;
  const store: LDFeatureStore = {
    get(
      kind: DataKind,
      flagKey: string,
      callback: (res: LDFeatureStoreItem | null) => void = noop
    ): void {
      const kindKey = kind.namespace === 'features' ? 'flags' : kind.namespace;
      logger.debug(`Requesting ${flagKey} from ${key}.${kindKey}`);

      kvNamespace
        .get(key)
        .then((i) => {
          if (!i) {
            throw new Error(`${key}.${kindKey} is not found in KV.`);
          }

          const item = deserializePoll(i);
          if (!item) {
            throw new Error(`Error deserializing ${kindKey}`);
          }
          callback(item[kindKey][flagKey]);
        })
        .catch((err) => {
          logger.error(err);
          callback(null);
        });
    },
    all(kind: DataKind, callback: (res: LDFeatureStoreKindData) => void = noop): void {
      const kindKey = kind.namespace === 'features' ? 'flags' : kind.namespace;
      logger.debug(`Requesting all from ${key}.${kindKey}`);
      kvNamespace
        .get(key)
        .then((i) => {
          if (!i) {
            throw new Error(`${key}.${kindKey} is not found in KV.`);
          }

          const item = deserializePoll(i);
          if (!item) {
            throw new Error(`Error deserializing ${kindKey}`);
          }

          callback(item[kindKey]);
        })
        .catch((err) => {
          logger.error(err);
          callback({});
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
