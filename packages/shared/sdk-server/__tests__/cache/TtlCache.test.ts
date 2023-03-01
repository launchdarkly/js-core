import TtlCache from '../../src/cache/TtlCache';

describe('given a ttl cache', () => {
  let ttlCache: TtlCache;

  beforeEach(() => {
    ttlCache = new TtlCache({ ttl: 60, checkInterval: 600 });
  });

  afterEach(() => {
    ttlCache.close();
    jest.restoreAllMocks();
  });

  it('when items are added and accessed within the TTL period.', () => {
    const count = 10;

    // Put some items in the cache.
    for (let i = 0; i < count; i += 1) {
      ttlCache.set(`${i}`, i);
    }

    // Check they are all there.
    for (let i = 0; i < count; i += 1) {
      expect(ttlCache.get(i.toString())).toEqual(i);
    }
  });

  it('when items are added and deleted within the TTL period.', () => {
    const count = 10;

    // Put some items in the cache.
    for (let i = 0; i < count; i += 1) {
      ttlCache.set(`${i}`, i);
    }

    for (let i = 0; i < count; i += 1) {
      ttlCache.delete(`${i}`);
    }

    // Check they are all removed.
    for (let i = 0; i < count; i += 1) {
      expect(ttlCache.get(i.toString())).toBeUndefined();
    }
  });

  it('when the cache has been cleared', () => {
    const count = 10;

    // Put some items in the cache.
    for (let i = 0; i < count; i += 1) {
      ttlCache.set(`${i}`, i);
    }

    ttlCache.clear();
    // Check the items do not exist.
    for (let i = 0; i < count; i += 1) {
      expect(ttlCache.get(i.toString())).toBeUndefined();
    }
  });

  it('items in the cache expire after the TTL.', () => {
    jest.spyOn(Date, 'now').mockImplementation(() => 0);

    ttlCache.set('0', 0);

    jest.spyOn(Date, 'now').mockImplementation(() => 60 * 1000 + 1);

    expect(ttlCache.get('0')).toBeUndefined();
  });

  it('setting an item refreshes its ttl.', () => {
    jest.spyOn(Date, 'now').mockImplementation(() => 0);

    ttlCache.set('0', 0);

    jest.spyOn(Date, 'now').mockImplementation(() => 60 * 1000);
    ttlCache.set('0', 0);
    jest.spyOn(Date, 'now').mockImplementation(() => 60 * 1000 + 10);

    expect(ttlCache.get('0')).toEqual(0);
  });

  it('getting an item does not refresh its ttl.', () => {
    jest.spyOn(Date, 'now').mockImplementation(() => 0);

    ttlCache.set('0', 0);

    jest.spyOn(Date, 'now').mockImplementation(() => 60 * 1000);
    ttlCache.get('0');
    jest.spyOn(Date, 'now').mockImplementation(() => 60 * 1000 + 10);

    expect(ttlCache.get('0')).toBeUndefined();
  });
});

describe('given a ttl cache with short check period and TTL', () => {
  let ttlCache: TtlCache;

  beforeEach(() => {
    ttlCache = new TtlCache({ ttl: 0.15, checkInterval: 0.25 });
  });

  afterEach(() => {
    ttlCache.close();
  });

  it('stale items are purged on the check interval.', (done) => {
    const count = 10;

    // Put some items in the cache.
    for (let i = 0; i < count; i += 1) {
      ttlCache.set(`${i}`, i);
    }

    setTimeout(() => {
      expect(ttlCache.size).toBe(0);
      done();
    }, 1000);
  });
});
