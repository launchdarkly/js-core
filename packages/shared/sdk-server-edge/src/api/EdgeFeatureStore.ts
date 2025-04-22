import type {
  DataKind,
  LDFeatureStore,
  LDFeatureStoreDataStorage,
  LDFeatureStoreItem,
  LDFeatureStoreKindData,
  LDLogger,
} from '@launchdarkly/js-server-sdk-common';
import { deserializePoll, noop } from '@launchdarkly/js-server-sdk-common';

import Cache from './cache';

export interface EdgeProvider {
  get: (rootKey: string) => Promise<string | null | undefined>;
}

export class EdgeFeatureStore implements LDFeatureStore {
  private readonly _rootKey: string;

  constructor(
    private readonly _edgeProvider: EdgeProvider,
    sdkKey: string,
    private readonly _description: string,
    private _logger: LDLogger,
    private _cache?: Cache,
  ) {
    this._rootKey = `LD-Env-${sdkKey}`;
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
      const storePayload = await this._getStorePayload();

      switch (namespace) {
        case 'features':
          callback(storePayload.flags[dataKey]);
          break;
        case 'segments':
          callback(storePayload.segments[dataKey]);
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
      const storePayload = await this._getStorePayload();

      switch (namespace) {
        case 'features':
          callback(storePayload.flags);
          break;
        case 'segments':
          callback(storePayload.segments);
          break;
        default:
          callback({});
      }
    } catch (err) {
      this._logger.error(err);
      callback({});
    }
  }

  /**
   * This method is used to retrieve the environment payload from the edge
   * provider. If a cache is provided, it will serve from that.
   */
  private async _getStorePayload(): Promise<
    Exclude<ReturnType<typeof deserializePoll>, undefined>
  > {
    let payload = this._cache?.get(this._rootKey);
    if (payload !== undefined) {
      return payload;
    }

    const providerData = await this._edgeProvider.get(this._rootKey);

    if (!providerData) {
      throw new Error(`${this._rootKey} is not found in KV.`);
    }

    payload = deserializePoll(providerData);
    if (!payload) {
      throw new Error(`Error deserializing ${this._rootKey}`);
    }

    this._cache?.set(this._rootKey, payload);

    return payload;
  }

  async initialized(callback: (isInitialized: boolean) => void = noop): Promise<void> {
    const config = await this._edgeProvider.get(this._rootKey);
    const result = config !== null;
    this._logger.debug(`Is ${this._rootKey} initialized? ${result}`);
    callback(result);
  }

  init(allData: LDFeatureStoreDataStorage, callback: () => void): void {
    this.applyChanges(true, allData, undefined, callback);
  }

  applyChanges(
    basis: boolean,
    data: LDFeatureStoreDataStorage,
    selector: String | undefined,
    callback: () => void,
  ): void {
    callback();
  }

  getDescription(): string {
    return this._description;
  }

  close(): void {
    return this._cache?.close();
  }

  // unused

  delete = noop;

  upsert = noop;
}
