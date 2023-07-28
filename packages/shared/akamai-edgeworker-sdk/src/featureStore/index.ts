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
  private readonly rootKey: string;

  constructor(
    private readonly edgeProvider: EdgeProvider,
    private readonly sdkKey: string,
    private readonly description: string,
    private logger: LDLogger,
  ) {
    this.rootKey = buildRootKey(this.sdkKey);
  }

  async get(
    kind: DataKind,
    dataKey: string,
    callback: (res: LDFeatureStoreItem | null) => void,
  ): Promise<void> {
    const { namespace } = kind;
    const kindKey = namespace === 'features' ? 'flags' : namespace;
    this.logger.debug(`Requesting ${dataKey} from ${this.rootKey}.${kindKey}`);

    try {
      const i = await this.edgeProvider.get(this.rootKey);

      if (!i) {
        throw new Error(`${this.rootKey}.${kindKey} is not found in KV.`);
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
    } catch (err) {
      this.logger.error(err);
      callback(null);
    }
  }

  async all(kind: DataKind, callback: (res: LDFeatureStoreKindData) => void = noop): Promise<void> {
    const { namespace } = kind;
    const kindKey = namespace === 'features' ? 'flags' : namespace;
    this.logger.debug(`Requesting all from ${this.rootKey}.${kindKey}`);
    try {
      const i = await this.edgeProvider.get(this.rootKey);
      if (!i) {
        throw new Error(`${this.rootKey}.${kindKey} is not found in KV.`);
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
      this.logger.error(err);
      callback({});
    }
  }

  async initialized(callback: (isInitialized: boolean) => void = noop): Promise<void> {
    const config = await this.edgeProvider.get(this.rootKey);
    const result = config !== null;
    this.logger.debug(`Is ${this.rootKey} initialized? ${result}`);
    callback(result);
  }

  init(allData: LDFeatureStoreDataStorage, callback: () => void): void {
    callback();
  }

  getDescription(): string {
    return this.description;
  }

  // unused
  close = noop;

  delete = noop;

  upsert = noop;
}
