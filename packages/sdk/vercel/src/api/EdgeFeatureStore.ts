import type {
  DataKind,
  LDFeatureStore,
  LDFeatureStoreDataStorage,
  LDFeatureStoreItem,
  LDFeatureStoreKindData,
  LDLogger,
} from '@launchdarkly/js-server-sdk-common-edge';
import { noop, reviveFullPayload } from '@launchdarkly/js-server-sdk-common-edge';

export interface EdgeProvider {
  get: (rootKey: string) => Promise<Record<string, any> | null | undefined>;
}

export class EdgeFeatureStore implements LDFeatureStore {
  private readonly _rootKey: string;
  private _lastRevivedPayload: ReturnType<typeof reviveFullPayload> | undefined;

  constructor(
    private readonly _edgeProvider: EdgeProvider,
    sdkKey: string,
    private readonly _description: string,
    private _logger: LDLogger,
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
   * provider.
   */
  private async _getStorePayload(): Promise<
    Exclude<ReturnType<typeof reviveFullPayload>, undefined>
  > {
    // Vercel Edge Config will return the same object reference if
    // the payload has not changed.
    const providerData = await this._edgeProvider.get(this._rootKey);

    if (!providerData) {
      throw new Error(`${this._rootKey} is not found in KV.`);
    }

    // Revived payloads are mutated in-place, so if the last revived
    // payload object reference is the same, we can just return it
    // and avoid processing it again.
    if (providerData === this._lastRevivedPayload) {
      return this._lastRevivedPayload;
    }

    const payload = reviveFullPayload(providerData);

    if (!payload) {
      throw new Error(`Error deserializing ${this._rootKey}`);
    }

    this._lastRevivedPayload = payload;

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

  close(): void {
    this._lastRevivedPayload = undefined;
  }

  // unused
  delete = noop;

  upsert = noop;
}
