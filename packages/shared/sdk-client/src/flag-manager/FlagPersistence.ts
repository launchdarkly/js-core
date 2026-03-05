import { Context, LDLogger, Platform } from '@launchdarkly/js-sdk-common';

import { FRESHNESS_SUFFIX, FreshnessRecord, hashContext } from '../storage/freshness';
import { loadCachedFlags } from '../storage/loadCachedFlags';
import { namespaceForContextData, namespaceForContextIndex } from '../storage/namespaceUtils';
import { Flags } from '../types';
import ContextIndex from './ContextIndex';
import FlagStore from './FlagStore';
import { FlagUpdater } from './FlagUpdater';
import { ItemDescriptor } from './ItemDescriptor';

/**
 * This class handles persisting and loading flag values from a persistent
 * store. It intercepts updates and forwards them to the flag updater and
 * then persists changes after the updater has completed.
 *
 * Freshness metadata (timestamp + context attribute hash) is stored in a
 * separate storage key (`{contextKey}_freshness`) alongside the flag data.
 * Both keys are managed together — when a context is evicted, both the flag
 * data and freshness record are cleared.
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
   */
  async loadCached(context: Context): Promise<boolean> {
    if (!this._platform.storage) {
      return false;
    }

    const cached = await loadCachedFlags(
      this._platform.storage,
      this._platform.crypto,
      this._environmentNamespace,
      context,
      this._logger,
    );
    if (!cached) {
      return false;
    }

    // Migrate data from version <10.3.1 stored under the canonical key
    if (cached.fromLegacyKey) {
      await this._platform.storage.set(cached.storageKey, JSON.stringify(cached.flags));
      await this._platform.storage.clear(context.canonicalKey);
    }

    // mapping flags to item descriptors
    const descriptors = Object.entries(cached.flags).reduce(
      (acc: { [k: string]: ItemDescriptor }, [key, flag]) => {
        acc[key] = { version: flag.version, flag };
        return acc;
      },
      {},
    );

    this._flagUpdater.initCached(context, descriptors);
    this._logger.debug('Loaded cached flag evaluations from persistent storage');
    return true;
  }

  private async _storeFreshness(
    contextStorageKey: string,
    context: Context,
    timestamp: number,
  ): Promise<void> {
    const contextHash = await hashContext(this._platform.crypto, context);
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
