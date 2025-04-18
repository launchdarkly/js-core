import { DataSourceList } from '../../src/datasource/dataSourceList';

it('replace is well behaved', async () => {
  const underTest = new DataSourceList(true, [1, 2, 3]);
  expect(underTest.next()).toEqual(1);
  expect(underTest.next()).toEqual(2);
  underTest.replace([4, 5, 6]);
  expect(underTest.next()).toEqual(4);
  expect(underTest.next()).toEqual(5);
  expect(underTest.next()).toEqual(6);
  expect(underTest.next()).toEqual(4);
  expect(underTest.next()).toEqual(5);
});

it('it cycles correctly after replacing non-empty list', async () => {
  const underTest = new DataSourceList(true, [1, 2, 3]);
  expect(underTest.next()).toEqual(1);
  expect(underTest.next()).toEqual(2);
  expect(underTest.next()).toEqual(3);

  underTest.remove(1);
  expect(underTest.next()).toEqual(2);
  expect(underTest.next()).toEqual(3);
  expect(underTest.next()).toEqual(2);
  expect(underTest.next()).toEqual(3);

  underTest.remove(3);
  expect(underTest.next()).toEqual(2);
  expect(underTest.next()).toEqual(2);

  underTest.remove(2);
  expect(underTest.next()).toBeUndefined();
  expect(underTest.next()).toBeUndefined();
  expect(underTest.next()).toBeUndefined();

  underTest.replace([4, 5, 6]);

  expect(underTest.next()).toEqual(4);
  expect(underTest.next()).toEqual(5);
  expect(underTest.next()).toEqual(6);

  underTest.remove(4);
  expect(underTest.next()).toEqual(5);
  expect(underTest.next()).toEqual(6);
  expect(underTest.next()).toEqual(5);
  expect(underTest.next()).toEqual(6);

  underTest.remove(6);
  expect(underTest.next()).toEqual(5);
  expect(underTest.next()).toEqual(5);

  underTest.remove(5);
  expect(underTest.next()).toBeUndefined();
  expect(underTest.next()).toBeUndefined();
});

it('cycles correctly after replacing empty list', async () => {
  const underTest = new DataSourceList<number>(true, []);

  underTest.replace([1, 2, 3]);

  expect(underTest.next()).toEqual(1);
  expect(underTest.next()).toEqual(2);
  expect(underTest.next()).toEqual(3);

  underTest.remove(1);
  expect(underTest.next()).toEqual(2);
  expect(underTest.next()).toEqual(3);
  expect(underTest.next()).toEqual(2);
  expect(underTest.next()).toEqual(3);

  underTest.remove(3);
  expect(underTest.next()).toEqual(2);
  expect(underTest.next()).toEqual(2);

  underTest.remove(2);
  expect(underTest.next()).toBeUndefined();
  expect(underTest.next()).toBeUndefined();
});

it('removing head is well behaved at start', async () => {
  const underTest = new DataSourceList(true, [1, 2, 3]);
  // head is now pointing to 1
  underTest.remove(1);
  expect(underTest.next()).toEqual(2);
  expect(underTest.next()).toEqual(3);
  expect(underTest.next()).toEqual(2);
});

it('removing head is well behaved in middle', async () => {
  const underTest = new DataSourceList(true, [1, 2, 3]);
  expect(underTest.next()).toEqual(1);
  // head is now pointing to 2
  underTest.remove(2);
  expect(underTest.next()).toEqual(3);
  expect(underTest.next()).toEqual(1);
  expect(underTest.next()).toEqual(3);
});

it('removing head is well behaved at end', async () => {
  const underTest = new DataSourceList(true, [1, 2, 3]);
  expect(underTest.next()).toEqual(1);
  expect(underTest.next()).toEqual(2);
  // head is now pointing to 3
  underTest.remove(3);
  expect(underTest.next()).toEqual(1);
  expect(underTest.next()).toEqual(2);
  expect(underTest.next()).toEqual(1);
});

it('removing existing returns true', async () => {
  const underTest = new DataSourceList<number>(true, [1]);
  expect(underTest.remove(1)).toEqual(true);
  expect(underTest.next()).toBeUndefined();
});

it('removing nonexistent returns false', async () => {
  const underTest = new DataSourceList<number>(true, []);
  expect(underTest.remove(1)).toEqual(false);
  expect(underTest.next()).toBeUndefined();
});

it('single element removed and next called', async () => {
  const underTest = new DataSourceList<number>(true, [1]);
  expect(underTest.remove(1)).toEqual(true);
  expect(underTest.next()).toBeUndefined();
});
