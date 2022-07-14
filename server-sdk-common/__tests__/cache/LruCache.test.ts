import LruCache from '../../src/cache/LruCache';

it('when items are added less than the max size', () => {
  const max = 5;
  const lruCache = new LruCache({ max });
  // Fill the cache with integers.
  for (let i = 0; i < max; i += 1) {
    lruCache.set(`${i}`, i);
  }

  // Check they are all there.
  for (let i = 0; i < max; i += 1) {
    expect(lruCache.get(i.toString())).toEqual(i);
  }
});

it('when the max size is exceeded', () => {
  const max = 5;
  const lruCache = new LruCache({ max });
  // Fill the cache with integers.
  for (let i = 0; i < max + 10; i += 1) {
    lruCache.set(`${i}`, i);
  }

  // Check they are all there.
  for (let i = 10; i < max + 10; i += 1) {
    expect(lruCache.get(i.toString())).toEqual(i);
  }
});

it('when it has been cleared', () => {
  const max = 5;
  const lruCache = new LruCache({ max });
  // Fill the cache with integers.
  for (let i = 0; i < max; i += 1) {
    lruCache.set(`${i}`, i);
  }

  lruCache.clear();

  for (let i = 0; i < max; i += 1) {
    expect(lruCache.get(i.toString())).toBeUndefined();
  }

  // Fill the cache with integers again.
  for (let i = 0; i < max; i += 1) {
    lruCache.set(`${i}`, i);
  }

  // Check they are all there.
  for (let i = 0; i < max; i += 1) {
    expect(lruCache.get(i.toString())).toEqual(i);
  }
});

it('when updating the single item in the cache', () => {
  const max = 5;
  const lruCache = new LruCache({ max });

  lruCache.set('0', 0);
  lruCache.set('0', 1);
  expect(lruCache.get('0')).toEqual(1);
});

it('when updating the head of the cache (that is not also the tail)', () => {
  const max = 5;
  const lruCache = new LruCache({ max });

  lruCache.set('0', 0);
  lruCache.set('1', 0);
  lruCache.set('0', 1);
  expect(lruCache.get('0')).toEqual(1);
});

it('when getting something that doesn\'t exist', () => {
  const max = 5;
  const lruCache = new LruCache({ max });

  expect(lruCache.get('0')).toBeUndefined();
});

it('when a key is re-used before the cache is full', () => {
  const max = 5;
  const lruCache = new LruCache({ max });

  lruCache.set('0', 0);
  lruCache.set('1', 1);
  lruCache.set('2', 2);
  lruCache.set('1', 2);
  lruCache.set('3', 3);
  expect(lruCache.get('0')).toEqual(0);
  expect(lruCache.get('1')).toEqual(2);
  expect(lruCache.get('2')).toEqual(2);
  expect(lruCache.get('3')).toEqual(3);
});

it('when getting an expired item', () => {
  const max = 5;
  const lruCache = new LruCache({ max, maxAge: 100 });

  Date.now = jest.fn(() => 0);
  lruCache.set('0', 0);
  Date.now = jest.fn(() => 101);
  lruCache.set('1', 1);

  expect(lruCache.get('0')).toBeUndefined();
  expect(lruCache.get('1')).toEqual(1);
});

it('getting an item keeps it recent', () => {
  const max = 5;
  const lruCache = new LruCache({ max });

  lruCache.set('0', 0);
  lruCache.set('1', 1);
  lruCache.set('2', 2);
  lruCache.set('3', 3);
  lruCache.set('4', 4);
  lruCache.get('0'); // 1 is now the least recently used.
  lruCache.set('5', 5);

  expect(lruCache.get('0')).toEqual(0);
  expect(lruCache.get('1')).toBeUndefined();
  expect(lruCache.get('2')).toEqual(2);
});
