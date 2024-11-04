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

/**
 * Builds the root key needed to retrieve environment payload from the feature store
 * @param sdkKey string
 * @returns
 */
export const buildRootKey = (sdkKey: string) => `LD-Env-${sdkKey}`;

export class EdgeFeatureStore implements LDFeatureStore {
  private readonly _rootKey: string;

  constructor(
    private readonly _edgeProvider: EdgeProvider,
    private readonly _sdkKey: string,
    private readonly _description: string,
    private _logger: LDLogger,
  ) {
    this._rootKey = buildRootKey(this._sdkKey);
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
      const i = await this._edgeProvider.get(this._rootKey);

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
      const i = await this._edgeProvider.get(this._rootKey);
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
          throw new Error(`Unsupported DataKind: ${namespace}`);
      }
    } catch (err) {
      this._logger.error(err);
      callback({});
    }
  }

  async initialized(callback: (isInitialized: boolean) => void = noop): Promise<void> {
    const config = await this._edgeProvider.get(this._rootKey);
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
