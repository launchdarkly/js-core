export class CacheItem {
  private _cachedAt: number;
  constructor(public readonly value: any) {
    this._cachedAt = Date.now();
  }

  fresh(ttl: number): boolean {
    return Date.now() - this._cachedAt < ttl;
  }
}
