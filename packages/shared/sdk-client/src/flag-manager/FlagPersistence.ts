import { Context, LDLogger, Platform } from '@launchdarkly/js-sdk-common';

import digest from '../crypto/digest';
import { namespaceForContextData, namespaceForContextIndex } from '../storage/namespaceUtils';
import { Flags } from '../types';
import ContextIndex from './ContextIndex';
import FlagStore from './FlagStore';
import { FlagUpdater } from './FlagUpdater';
import { ItemDescriptor } from './ItemDescriptor';

/**
 * Suffix appended to context storage keys to form the freshness storage key.
 */
const FRESHNESS_SUFFIX = '_freshness';

/**
 * Persisted freshness record stored at `{contextStorageKey}_freshness`.
 */
interface FreshnessRecord {
  /** Timestamp in ms since epoch when data was last received. */
  timestamp: number;
  /** SHA-256 hash of the full context's canonical JSON. */
  contextHash: string;
}

async function hashContext(platform: Platform, context: Context): Promise<string | undefined> {
  const json = context.canonicalUnfilteredJson();
  if (!json) {
    return undefined;
  }
  return digest(platform.crypto.createHash('sha256').update(json), 'base64');
}

/**
 * This class handles persisting and loading flag values from a persistent
 * store. It intercepts updates and forwards them to the flag updater and
 * then persists changes after the updater has completed.
 *
 * Freshness metadata (timestamp + context attribute hash) is stored in a
 * separate storage key (`{contextKey}_freshness`) alongside the flag data.
 * Both keys are managed together — when a context is evicted, both the flag
 * data and freshness record are cleared.
 *
 * When {@link loadCached} is called, the freshness timestamp is read from
 * storage and passed to {@link FlagUpdater.initCached} alongside the flags.
 */
export default class FlagPersistence {
  private _contextIndex: ContextIndex | undefined;
  private _indexKey?: string;
  private _indexKeyPromise: Promise<string>;

  constructor(
    private readonly _platform: Platform,
    private readonly _environmentNamespace: string,
    private readonly _maxCachedContexts: number,
    private readonly _flagStore: FlagStore,
    private readonly _flagUpdater: FlagUpdater,
    private readonly _logger: LDLogger,
    private readonly _timeStamper: () => number = () => Date.now(),
  ) {
    this._indexKeyPromise = namespaceForContextIndex(this._environmentNamespace);
  }

  /**
   * Inits flag persistence for the provided context with the provided flags.  This will result
   * in the underlying {@link FlagUpdater} switching its active context.
   */
  async init(context: Context, newFlags: { [key: string]: ItemDescriptor }): Promise<void> {
    this._flagUpdater.init(context, newFlags);
    await this._storeCache(context);
  }

  /**
   * Upserts a flag into the {@link FlagUpdater} and stores that to persistence if the upsert
   * was successful / accepted.  An upsert may be rejected if the provided context is not
   * the active context.
   */
  async upsert(context: Context, key: string, item: ItemDescriptor): Promise<boolean> {
    if (this._flagUpdater.upsert(context, key, item)) {
      await this._storeCache(context);
      return true;
    }
    return false;
  }

  /**
   * Loads the flags from persistence for the provided context and gives those to the
   * {@link FlagUpdater} this {@link FlagPersistence} was constructed with.
   *
   * Also reads the freshness timestamp and passes it to {@link FlagUpdater.initCached}.
   */
  async loadCached(context: Context): Promise<boolean> {
    const storageKey = await namespaceForContextData(
      this._platform.crypto,
      this._environmentNamespace,
      context,
    );
    let flagsJson = await this._platform.storage?.get(storageKey);
    if (flagsJson === null || flagsJson === undefined) {
      // Fallback: in version <10.3.1 flag data was stored under the canonical key, check
      // to see if data is present and migrate the data if present.
      flagsJson = await this._platform.storage?.get(context.canonicalKey);
      if (flagsJson === null || flagsJson === undefined) {
        // return false indicating cache did not load if flag json is still absent
        return false;
      }

      // migrate data from version <10.3.1 and cleanup data that was under canonical key
      await this._platform.storage?.set(storageKey, flagsJson);
      await this._platform.storage?.clear(context.canonicalKey);
    }

    try {
      const flags: Flags = JSON.parse(flagsJson);

      // mapping flags to item descriptors
      const descriptors = Object.entries(flags).reduce(
        (acc: { [k: string]: ItemDescriptor }, [key, flag]) => {
          acc[key] = { version: flag.version, flag };
          return acc;
        },
        {},
      );

      const freshness = await this._readFreshness(storageKey, context);
      this._flagUpdater.initCached(context, descriptors, freshness);
      this._logger.debug('Loaded cached flag evaluations from persistent storage');

      return true;
    } catch (e: any) {
      this._logger.warn(
        `Could not load cached flag evaluations from persistent storage: ${e.message}`,
      );
      return false;
    }
  }

  /**
   * Reads the freshness timestamp from storage for the given context.
   * Returns `undefined` if no freshness exists, the data is corrupt,
   * or the context attributes have changed since the freshness was recorded.
   */
  private async _readFreshness(
    contextStorageKey: string,
    context: Context,
  ): Promise<number | undefined> {
    const json = await this._platform.storage?.get(`${contextStorageKey}${FRESHNESS_SUFFIX}`);
    if (json === null || json === undefined) {
      return undefined;
    }

    try {
      const record: FreshnessRecord = JSON.parse(json);
      const currentHash = await hashContext(this._platform, context);
      if (currentHash === undefined || record.contextHash !== currentHash) {
        return undefined;
      }
      return typeof record.timestamp === 'number' && !Number.isNaN(record.timestamp)
        ? record.timestamp
        : undefined;
    } catch {
      return undefined;
    }
  }

  private async _storeFreshness(
    contextStorageKey: string,
    context: Context,
    timestamp: number,
  ): Promise<void> {
    const contextHash = await hashContext(this._platform, context);
    if (contextHash === undefined) {
      this._logger.error('Could not serialize context for freshness tracking');
      return;
    }
    const record: FreshnessRecord = { timestamp, contextHash };
    await this._platform.storage?.set(
      `${contextStorageKey}${FRESHNESS_SUFFIX}`,
      JSON.stringify(record),
    );
  }

  private async _loadIndex(): Promise<ContextIndex> {
    if (this._contextIndex !== undefined) {
      return this._contextIndex;
    }

    const json = await this._platform.storage?.get(await this._indexKeyPromise);
    if (!json) {
      this._contextIndex = new ContextIndex();
      return this._contextIndex;
    }

    try {
      this._contextIndex = ContextIndex.fromJson(json);
      this._logger.debug('Loaded context index from persistent storage');
    } catch (e: any) {
      this._logger.warn(`Could not load index from persistent storage: ${e.message}`);
      this._contextIndex = new ContextIndex();
    }
    return this._contextIndex;
  }

  private async _storeCache(context: Context): Promise<void> {
    const now = this._timeStamper();
    const index = await this._loadIndex();
    const storageKey = await namespaceForContextData(
      this._platform.crypto,
      this._environmentNamespace,
      context,
    );
    index.notice(storageKey, now);

    const pruned = index.prune(this._maxCachedContexts);
    await Promise.all(
      pruned.flatMap((it) => [
        this._platform.storage?.clear(it.id),
        this._platform.storage?.clear(`${it.id}${FRESHNESS_SUFFIX}`),
      ]),
    );

    // store index
    await this._platform.storage?.set(await this._indexKeyPromise, index.toJson());
    const allFlags = this._flagStore.getAll();

    // mapping item descriptors to flags
    const flags = Object.entries(allFlags).reduce((acc: Flags, [key, descriptor]) => {
      if (descriptor.flag !== null && descriptor.flag !== undefined) {
        acc[key] = descriptor.flag;
      }
      return acc;
    }, {});

    // store freshness before flag data so that flag data remains the last
    // storage write (existing tests depend on this ordering)
    await this._storeFreshness(storageKey, context, now);

    const jsonAll = JSON.stringify(flags);
    // store flag data
    await this._platform.storage?.set(storageKey, jsonAll);
  }
}
