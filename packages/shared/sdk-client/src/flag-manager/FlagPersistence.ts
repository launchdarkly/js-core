import { Context, LDLogger, Platform } from '@launchdarkly/js-sdk-common';

import { Flags } from '../types';
import { concatNamespacesAndValues } from '../utils/namespaceUtils';
import ContextIndex from './ContextIndex';
import FlagStore from './FlagStore';
import FlagUpdater from './FlagUpdater';
import { ItemDescriptor } from './ItemDescriptor';

export default class FlagPersistence {
  private contextIndex: ContextIndex | undefined;
  private indexKey: string;

  constructor(
    private readonly platform: Platform,
    private readonly environmentNamespace: string,
    private readonly maxCachedContexts: number,
    private readonly flagStore: FlagStore,
    private readonly flagUpdater: FlagUpdater,
    private readonly logger: LDLogger,
    private readonly timeStamper: () => number = () => Date.now(),
  ) {
    // TODO: update to use helper function
    this.indexKey = concatNamespacesAndValues(platform.crypto, [
      { value: this.environmentNamespace, hashIt: false },
      { value: 'ContextIndex', hashIt: false },
    ]);
  }

  async init(context: Context, newFlags: { [key: string]: ItemDescriptor }): Promise<void> {
    this.flagUpdater.init(context, newFlags);
    return this.storeCache(context);
  }

  async upsert(context: Context, key: string, item: ItemDescriptor): Promise<boolean> {
    if (this.flagUpdater.upsert(context, key, item)) {
      await this.storeCache(context);
      return true;
    }
    return false;
  }

  async loadCached(context: Context): Promise<boolean> {
    // TODO: update to use helper function
    const storageKey = concatNamespacesAndValues(this.platform.crypto, [
      { value: this.environmentNamespace, hashIt: false }, // use namespace as is
      { value: context.canonicalKey, hashIt: true }, // hash canonical key
    ]);
    const flagsJson = await this.platform.storage?.get(storageKey);
    if (flagsJson === null || flagsJson === undefined) {
      return false;
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

      this.flagUpdater.initCached(context, descriptors);
      this.logger.debug('Loaded cached flag evaluations from persistent storage');
      return true;
    } catch (e: any) {
      this.logger.warn(
        `Could not load cached flag evaluations from persistent storage: ${e.message}`,
      );
      return false;
    }
  }

  private async loadIndex(): Promise<ContextIndex> {
    if (this.contextIndex !== undefined) {
      return this.contextIndex;
    }

    const json = await this.platform.storage?.get(this.indexKey);
    if (json === null || json === undefined) {
      this.contextIndex = new ContextIndex();
      return this.contextIndex;
    }

    try {
      this.contextIndex = ContextIndex.fromJson(json);
      this.logger.debug('Loaded context index from persistent storage');
    } catch (e: any) {
      this.logger.warn(`Could not load index from persistent storage: ${e.message}`);
      this.contextIndex = new ContextIndex();
    }
    return this.contextIndex;
  }

  private async storeCache(context: Context): Promise<void> {
    const index = await this.loadIndex();
    // TODO: update to use helper function
    const contextStorageKey = concatNamespacesAndValues(this.platform.crypto, [
      { value: this.environmentNamespace, hashIt: false },
      { value: context.canonicalKey, hashIt: true },
    ]);
    index.notice(contextStorageKey, this.timeStamper());

    const pruned = index.prune(this.maxCachedContexts);
    pruned.forEach(async (it) => {
      await this.platform.storage?.clear(it.id);
    });

    // store index
    await this.platform.storage?.set(this.indexKey, index.toJson());
    const allFlags = this.flagStore.getAll();

    // mapping item descriptors to flags
    const flags = Object.entries(allFlags).reduce((acc: Flags, [key, descriptor]) => {
      if (descriptor.flag !== null && descriptor.flag !== undefined) {
        acc[key] = descriptor.flag;
      }
      return acc;
    }, {});

    const jsonAll = JSON.stringify(flags);
    // store flag data
    await this.platform.storage?.set(contextStorageKey, jsonAll);
  }
}
