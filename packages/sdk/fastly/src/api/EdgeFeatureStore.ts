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
  get: (rootKey: string) => Promise<string | null | undefined>;
}

export class EdgeFeatureStore implements LDFeatureStore {
  private readonly _rootKey: string;
  private _kvData: string | null | undefined;

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
  private async _getKVData(): Promise<string | null | undefined> {
    if (!this._kvData) {
      this._kvData = await this._edgeProvider.get(this._rootKey);
    }
    return this._kvData;
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
      const i = await this._getKVData();

      if (!i) {
        throw new Error(`${this._rootKey}.${kindKey} is not found in KV.`);
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
      const i = await this._getKVData();
      if (!i) {
        throw new Error(`${this._rootKey}.${kindKey} is not found in KV.`);
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
          callback({});
      }
    } catch (err) {
      this._logger.error(err);
      callback({});
    }
  }

  async initialized(callback: (isInitialized: boolean) => void = noop): Promise<void> {
    const config = await this._getKVData();
    const result = config !== null;
    this._logger.debug(`Is ${this._rootKey} initialized? ${result}`);
    callback(result);
  }

  init(allData: LDFeatureStoreDataStorage, callback: () => void): void {
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
