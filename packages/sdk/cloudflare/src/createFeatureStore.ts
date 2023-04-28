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
      dataKey: string,
      callback: (res: LDFeatureStoreItem | null) => void = noop
    ): void {
      const { namespace } = kind;
      const kindKey = namespace === 'features' ? 'flags' : namespace;
      logger.debug(`Requesting ${dataKey} from ${key}.${kindKey}`);

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

          switch (namespace) {
            case 'features':
              callback(item.flags[dataKey]);
              break;
            case 'segments':
              callback(item.segments[dataKey]);
              break;
            default:
              throw new Error(`Unsupported DataKind: ${namespace}`);
          }
        })
        .catch((err) => {
          logger.error(err);
          callback(null);
        });
    },
    all(kind: DataKind, callback: (res: LDFeatureStoreKindData) => void = noop): void {
      const { namespace } = kind;
      const kindKey = namespace === 'features' ? 'flags' : namespace;
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

          switch (namespace) {
            case 'features':
              callback(item.flags);
              break;
            case 'segments':
              callback(item.segments);
              break;
            default:
              throw new Error(`Unsupported DataKind: ${namespace}`);
          }
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
