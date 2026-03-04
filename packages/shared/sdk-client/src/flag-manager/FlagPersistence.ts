import { Context, LDLogger, Platform } from '@launchdarkly/js-sdk-common';

import digest from '../crypto/digest';
import { namespaceForContextData, namespaceForContextIndex } from '../storage/namespaceUtils';
import { Flags } from '../types';
import ContextIndex from './ContextIndex';
import FlagStore from './FlagStore';
import { FlagUpdater } from './FlagUpdater';
import { ItemDescriptor } from './ItemDescriptor';

/**
 * The persisted cache record. Wraps flag data with freshness metadata.
 *
 * The `freshness` field records when data was last received and a hash of the
 * full context attributes. When a context's attributes change (even if the key
 * is the same), the hash differs and the freshness is treated as stale.
 *
 * For backward compatibility, records stored in the old format (just a bare
 * `Flags` object) are read as flags with no freshness.
 */
interface CacheRecord {
  flags: Flags;
  freshness?: {
    timestamp: number;
    contextHash: string;
  };
}

/**
 * Returns true if the parsed object looks like a {@link CacheRecord} (new
 * format) rather than a bare {@link Flags} object (old format).
 *
 * Detection: the new format always has a `flags` property that is a non-null
 * object. The old format has flag keys at the top level, each containing a
 * `version` number — a shape that won't have a nested object under `flags`.
 */
function isCacheRecord(parsed: any): parsed is CacheRecord {
  return parsed !== null && typeof parsed === 'object' && typeof parsed.flags === 'object';
}

function parseCacheRecord(json: string): CacheRecord {
  const parsed = JSON.parse(json);
  if (isCacheRecord(parsed)) {
    return parsed;
  }
  // Old format: bare Flags object. Wrap it with no freshness.
  return { flags: parsed as Flags };
}

async function hashContext(platform: Platform, context: Context): Promise<string> {
  const json = context.canonicalUnfilteredJson();
  if (!json) {
    return '';
  }
  return digest(platform.crypto.createHash('sha256').update(json), 'base64');
}

/**
 * This class handles persisting and loading flag values from a persistent
 * store. It intercepts updates and forwards them to the flag updater and
 * then persists changes after the updater has completed.
 *
 * Freshness metadata (timestamp + context attribute hash) is stored inside
 * the same record as the flag data. This ensures freshness is automatically
 * cleaned up when a context is evicted.
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
      const record = parseCacheRecord(flagsJson);

      // mapping flags to item descriptors
      const descriptors = Object.entries(record.flags).reduce(
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

  /**
   * Returns the freshness timestamp for the given context, or `undefined`
   * if no freshness data exists or the context attributes have changed
   * since freshness was last recorded.
   */
  async getFreshness(context: Context): Promise<number | undefined> {
    const storageKey = await namespaceForContextData(
      this._platform.crypto,
      this._environmentNamespace,
      context,
    );
    const json = await this._platform.storage?.get(storageKey);
    if (json === null || json === undefined) {
      return undefined;
    }

    try {
      const record = parseCacheRecord(json);
      if (!record.freshness) {
        return undefined;
      }

      const currentHash = await hashContext(this._platform, context);
      if (record.freshness.contextHash !== currentHash) {
        return undefined;
      }

      return record.freshness.timestamp;
    } catch {
      return undefined;
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
    const now = this._timeStamper();
    const index = await this._loadIndex();
    const storageKey = await namespaceForContextData(
      this._platform.crypto,
      this._environmentNamespace,
      context,
    );
    index.notice(storageKey, now);

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

    const record: CacheRecord = {
      flags,
      freshness: {
        timestamp: now,
        contextHash: await hashContext(this._platform, context),
      },
    };

    // store flag data with freshness
    await this._platform.storage?.set(storageKey, JSON.stringify(record));
  }
}
