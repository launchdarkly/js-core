import type {
  DataKind,
  LDFeatureStore,
  LDFeatureStoreDataStorage,
  LDFeatureStoreItem,
  LDFeatureStoreKindData,
  LDLogger,
} from '@launchdarkly/js-server-sdk-common';
import { deserializePoll, noop } from '@launchdarkly/js-server-sdk-common';

export interface EdgeProvider {
  get: (rootKey: string) => Promise<string | null>;
}

export class EdgeFeatureStore implements LDFeatureStore {
  private readonly _rootKey: string;
  private _deserializedPromise: Promise<LDFeatureStoreDataStorage | null> | null = null;

  constructor(
    private readonly _edgeProvider: EdgeProvider,
    sdkKey: string,
    private readonly _description: string,
    private _logger: LDLogger,
  ) {
    this._rootKey = `LD-Env-${sdkKey}`;
  }

  /**
   * This function is used to lazy load the KV data from the edge provider. This is necessary because Fastly Compute
   * has a limit of 32 backend requests (including requests to fetch the KV data).
   * https://docs.fastly.com/products/compute-resource-limits
   */
  private async _getKVData(): Promise<LDFeatureStoreDataStorage | null> {
    if (!this._deserializedPromise) {
      this._deserializedPromise = (async (): Promise<LDFeatureStoreDataStorage | null> => {
        this._logger.debug('No cached data found, loading from KV store');
        const kvData = await this._edgeProvider.get(this._rootKey);
        if (!kvData) {
          this._logger.debug('No data found in KV store');
          return null;
        }

        this._logger.debug('Deserializing KV store data');
        const deserialized = deserializePoll(kvData);
        if (!deserialized) {
          this._logger.debug('Failed to deserialize KV store data');
          return null;
        }

        // Convert FlagsAndSegments to LDFeatureStoreDataStorage format
        const deserializedData: LDFeatureStoreDataStorage = {
          features: deserialized.flags,
          segments: deserialized.segments,
        };
        this._logger.debug('Successfully cached deserialized data');

        return deserializedData;
      })();
    } else {
      this._logger.debug('Using cached deserialized data');
    }
    return this._deserializedPromise;
  }

  async get(
    kind: DataKind,
    dataKey: string,
    callback: (res: LDFeatureStoreItem | null) => void,
  ): Promise<void> {
    const { namespace } = kind;
    const kindKey = namespace === 'features' ? 'flags' : namespace;
    this._logger.debug(`Requesting ${dataKey} from ${this._rootKey}.${kindKey}`);

    try {
      const data = await this._getKVData();

      if (!data) {
        throw new Error(`${this._rootKey}.${kindKey} is not found in KV.`);
      }

      switch (namespace) {
        case 'features':
          callback(data.features[dataKey]);
          break;
        case 'segments':
          callback(data.segments[dataKey]);
          break;
        default:
          callback(null);
      }
    } catch (err) {
      this._logger.error(err);
      callback(null);
    }
  }

  async all(kind: DataKind, callback: (res: LDFeatureStoreKindData) => void = noop): Promise<void> {
    const { namespace } = kind;
    const kindKey = namespace === 'features' ? 'flags' : namespace;
    this._logger.debug(`Requesting all from ${this._rootKey}.${kindKey}`);
    try {
      const data = await this._getKVData();
      if (!data) {
        throw new Error(`${this._rootKey}.${kindKey} is not found in KV.`);
      }

      switch (namespace) {
        case 'features':
          callback(data.features);
          break;
        case 'segments':
          callback(data.segments);
          break;
        default:
          callback({});
      }
    } catch (err) {
      this._logger.error(err);
      callback({});
    }
  }

  async initialized(callback: (isInitialized: boolean) => void = noop): Promise<void> {
    const deserialized = await this._getKVData();
    const result = deserialized !== null;
    this._logger.debug(`Is ${this._rootKey} initialized? ${result}`);
    callback(result);
  }

  init(allData: LDFeatureStoreDataStorage, callback: () => void): void {
    this._getKVData();
    callback();
  }

  getDescription(): string {
    return this._description;
  }

  // unused
  close = noop;

  delete = noop;

  upsert = noop;
}
