import { Context, subsystem } from '@launchdarkly/js-sdk-common';

import LruCache from '../cache/LruCache';

export interface ContextDeduplicatorOptions {
  contextKeysFlushInterval: number;
  contextKeysCapacity: number;
}

export default class ContextDeduplicator implements subsystem.LDContextDeduplicator {
  public readonly flushInterval: number;

  private _contextKeysCache: LruCache;

  constructor(options: ContextDeduplicatorOptions) {
    this._contextKeysCache = new LruCache({ max: options.contextKeysCapacity });
    this.flushInterval = options.contextKeysFlushInterval;
  }

  public processContext(context: Context): boolean {
    const { canonicalKey } = context;
    const inCache = this._contextKeysCache.get(canonicalKey);
    this._contextKeysCache.set(canonicalKey, true);

    // If it is in the cache, then we do not want to add an event.
    return !inCache;
  }

  public flush(): void {
    this._contextKeysCache.clear();
  }
}
