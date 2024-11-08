import filterUrl from '../../src/filters/filterUrl';

it('runs the specified filters in the given order', () => {
  const filterA = (url: string): string => url.replace('dog', 'cat');
  const filterB = (url: string): string => url.replace('cat', 'mouse');

  // dog -> cat -> mouse
  expect(filterUrl([filterA, filterB], 'dog')).toBe('mouse');
  // dog -> dog -> cat
  expect(filterUrl([filterB, filterA], 'dog')).toBe('cat');
  // cat -> mouse -> mouse
  expect(filterUrl([filterB, filterA], 'cat')).toBe('mouse');
});
