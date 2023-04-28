import type {
  DataKind,
  LDLogger,
  LDFeatureStore,
  LDFeatureStoreDataStorage,
  LDFeatureStoreItem,
  LDFeatureStoreKindData,
} from '@launchdarkly/js-server-sdk-common';
import { deserializePoll, noop } from '@launchdarkly/js-server-sdk-common';

export interface EdgeProvider {
  get: (rootKey: string) => Promise<string>;
}

export class EdgeFeatureStore implements LDFeatureStore {
  private readonly rootKey: string;

  private readonly description: string;

  private edgeProvider: EdgeProvider;

  private logger: LDLogger;

  constructor(edgeProvider: EdgeProvider, sdkKey: string, description: string, logger: LDLogger) {
    this.edgeProvider = edgeProvider;
    this.rootKey = `LD-Env-${sdkKey}`;
    this.description = description;
    this.logger = logger;
  }

  async get(
    kind: DataKind,
    dataKey: string,
    callback: (res: LDFeatureStoreItem | null) => void
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
