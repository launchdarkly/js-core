/**
 * @internal
 */
export interface LruCacheOptions {
  /**
   * The maximum items to keep in the cache.
   */
  max: number,
  /**
   * The maximum age, in milliseconds, for items in the cache.
   */
  maxAge?: number
}

export default class LruCache {
  private values: any[];

  private keys: Array<string | undefined>;

  private lastUpdated: number[];

  private next: Uint32Array;

  private prev: Uint32Array;

  private keyMap: Map<string, number> = new Map();

  private head: number = 0;

  private tail: number = 0;

  private max: number;

  private size: number = 0;

  private maxAge: number;

  constructor(options: LruCacheOptions) {
    const { max } = options;
    this.max = max;
    // This is effectively a struct-of-arrays implementation
    // of a linked list. All the nodes exist statically and then
    // the links between them are changed by updating the previous/next
    // arrays.
    this.values = new Array(max).fill(undefined);
    this.keys = new Array(max).fill(undefined);
    this.next = new Uint32Array(max);
    this.prev = new Uint32Array(max);

    if (options.maxAge) {
      this.lastUpdated = new Array(max).fill(0);
      this.maxAge = options.maxAge;
    } else {
      // To please linting.
      this.lastUpdated = [];
      this.maxAge = 0;
    }
  }

  set(key: string, val: any) {
    let index = this.keyMap.get(key);
    if (index === undefined) {
      index = this.index();
      this.keys[index] = key;
      this.keyMap.set(key, index);
      this.next[this.tail] = index;
      this.prev[index] = this.tail;
      this.tail = index;
      this.size += 1;
    } else {
      this.setTail(index);
    }

    this.values[index] = val;
    if (this.maxAge) {
      this.lastUpdated[index] = Date.now();
    }
  }

  get(key: string): any {
    const index = this.keyMap.get(key);
    if (index !== undefined) {
      if (this.maxAge) {
        const lastUpdated = this.lastUpdated[index];
        if ((Date.now() - lastUpdated) > this.maxAge) {
          // The oldest items are always the head, so they get incrementally
          // replaced. This would not be the case if we supported per item TTL.
          return undefined;
        }
      }

      this.setTail(index);
      if (this.maxAge) {
        this.lastUpdated[index] = Date.now();
      }

      return this.values[index];
    }
    return undefined;
  }

  clear() {
    this.head = 0;
    this.tail = 0;
    this.size = 0;
    this.values.fill(undefined);
    this.keys.fill(undefined);
    this.next.fill(0);
    this.prev.fill(0);
  }

  private index() {
    if (this.size === 0) {
      return this.tail;
    }
    if (this.size === this.max) {
      return this.evict();
    }
    // The initial list is being populated, so we can just continue increasing size.
    return this.size;
  }

  private evict(): number {
    const { head } = this;
    const k = this.keys[head];
    this.head = this.next[head];
    this.keyMap.delete(k!);
    this.size -= 1;
    return head;
  }

  private link(p: number, n: number) {
    this.prev[n] = p;
    this.next[p] = n;
  }

  private setTail(index: number) {
    // If it is already the tail, then there is nothing to do.
    if (index !== this.tail) {
      // If this is the head, then we change the next item
      // to the head.
      if (index === this.head) {
        this.head = this.next[index];
      } else {
        // Link the previous item to the next item, effectively removing
        // the current node.
        this.link(this.prev[index], this.next[index]);
      }
      // Connect the current tail to this node.
      this.link(this.tail, index);
      this.tail = index;
    }
  }
}
