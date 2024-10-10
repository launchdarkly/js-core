/**
 * @internal
 */
export interface LruCacheOptions {
  /**
   * The maximum items to keep in the cache.
   */
  max: number;
  /**
   * The maximum age, in milliseconds, for items in the cache.
   */
  maxAge?: number;
}

/**
 * @internal
 */
export default class LruCache {
  private _values: any[];

  private _keys: Array<string | undefined>;

  private _lastUpdated: number[];

  private _next: Uint32Array;

  private _prev: Uint32Array;

  private _keyMap: Map<string, number> = new Map();

  private _head: number = 0;

  private _tail: number = 0;

  private _max: number;

  private _size: number = 0;

  private _maxAge: number;

  constructor(options: LruCacheOptions) {
    const { max } = options;
    this._max = max;
    // This is effectively a struct-of-arrays implementation
    // of a linked list. All the nodes exist statically and then
    // the links between them are changed by updating the previous/next
    // arrays.
    this._values = new Array(max);
    this._keys = new Array(max);
    this._next = new Uint32Array(max);
    this._prev = new Uint32Array(max);

    if (options.maxAge) {
      this._lastUpdated = new Array(max).fill(0);
      this._maxAge = options.maxAge;
    } else {
      // To please linting.
      this._lastUpdated = [];
      this._maxAge = 0;
    }
  }

  set(key: string, val: any) {
    let index = this._keyMap.get(key);
    if (index === undefined) {
      index = this._index();
      this._keys[index] = key;
      this._keyMap.set(key, index);
      this._next[this._tail] = index;
      this._prev[index] = this._tail;
      this._tail = index;
      this._size += 1;
    } else {
      this._setTail(index);
    }

    this._values[index] = val;
    if (this._maxAge) {
      this._lastUpdated[index] = Date.now();
    }
  }

  get(key: string): any {
    const index = this._keyMap.get(key);
    if (index !== undefined) {
      if (this._maxAge) {
        const lastUpdated = this._lastUpdated[index];
        if (Date.now() - lastUpdated > this._maxAge) {
          // The oldest items are always the head, so they get incrementally
          // replaced. This would not be the case if we supported per item TTL.
          return undefined;
        }
      }

      this._setTail(index);
      if (this._maxAge) {
        this._lastUpdated[index] = Date.now();
      }

      return this._values[index];
    }
    return undefined;
  }

  clear() {
    this._head = 0;
    this._tail = 0;
    this._size = 0;
    this._values.fill(undefined);
    this._keys.fill(undefined);
    this._next.fill(0);
    this._prev.fill(0);
    this._keyMap.clear();
  }

  private _index() {
    if (this._size === 0) {
      return this._tail;
    }
    if (this._size === this._max) {
      return this._evict();
    }
    // The initial list is being populated, so we can just continue increasing size.
    return this._size;
  }

  private _evict(): number {
    const { _head: head } = this;
    const k = this._keys[head];
    this._head = this._next[head];
    this._keyMap.delete(k!);
    this._size -= 1;
    return head;
  }

  private _link(p: number, n: number) {
    this._prev[n] = p;
    this._next[p] = n;
  }

  private _setTail(index: number) {
    // If it is already the tail, then there is nothing to do.
    if (index !== this._tail) {
      // If this is the head, then we change the next item
      // to the head.
      if (index === this._head) {
        this._head = this._next[index];
      } else {
        // Link the previous item to the next item, effectively removing
        // the current node.
        this._link(this._prev[index], this._next[index]);
      }
      // Connect the current tail to this node.
      this._link(this._tail, index);
      this._tail = index;
    }
  }
}
