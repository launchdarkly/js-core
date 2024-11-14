import { Context, LDLogger, Platform } from '@launchdarkly/js-sdk-common';

import { namespaceForContextData, namespaceForContextIndex } from '../storage/namespaceUtils';
import { Flags } from '../types';
import ContextIndex from './ContextIndex';
import FlagStore from './FlagStore';
import FlagUpdater from './FlagUpdater';
import { ItemDescriptor } from './ItemDescriptor';

/**
 * This class handles persisting and loading flag values from a persistent
 * store. It intercepts updates and forwards them to the flag updater and
 * then persists changes after the updater has completed.
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

      this._flagUpdater.initCached(context, descriptors);
      this._logger.debug('Loaded cached flag evaluations from persistent storage');
      return true;
    } catch (e: any) {
      this._logger.warn(
        `Could not load cached flag evaluations from persistent storage: ${e.message}`,
      );
      return false;
    }
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
    const index = await this._loadIndex();
    const storageKey = await namespaceForContextData(
      this._platform.crypto,
      this._environmentNamespace,
      context,
    );
    index.notice(storageKey, this._timeStamper());

    const pruned = index.prune(this._maxCachedContexts);
    await Promise.all(pruned.map(async (it) => this._platform.storage?.clear(it.id)));

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

    const jsonAll = JSON.stringify(flags);
    // store flag data
    await this._platform.storage?.set(storageKey, jsonAll);
  }
}
