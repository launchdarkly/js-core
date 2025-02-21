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

/**
 * Builds the root key needed to retrieve environment payload from the feature store
 * @param sdkKey string
 * @returns
 */
export const buildRootKey = (sdkKey: string) => `LD-Env-${sdkKey}`;

export class EdgeFeatureStore implements LDFeatureStore {
  private readonly _rootKey: string;
  private _cache: Cache;

  constructor(
    private readonly _edgeProvider: EdgeProvider,
    private readonly _sdkKey: string,
    private readonly _description: string,
    private _logger: LDLogger,
    _cacheTtlMs: number,
  ) {
    this._rootKey = buildRootKey(this._sdkKey);
    this._cache = new Cache(_cacheTtlMs);
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
      if (!storePayload) {
        throw new Error(`Error deserializing ${this._rootKey}`);
      }

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
      if (!storePayload) {
        throw new Error(`${this._rootKey}.${kindKey} is not found in KV.`);
      }

      switch (namespace) {
        case 'features':
          callback(storePayload.flags);
          break;
        case 'segments':
          callback(storePayload.segments);
          break;
        default:
          throw new Error(`Unsupported DataKind: ${namespace}`);
      }
    } catch (err) {
      this._logger.error(err);
      callback({});
    }
  }

  // This method is used to retrieve the environment payload from the edge
  // provider. It will cache the payload for the duration of the cacheTtlMs.
  private async _getStorePayload(): Promise<ReturnType<typeof deserializePoll>> {
    let payload = this._cache.get();
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

    this._cache.set(payload);

    return payload;
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
