import ContextIndex from '../../src/flag-manager/ContextIndex';

describe('ContextIndex tests', () => {
  test('notice adds to index', async () => {
    const indexUnderTest = new ContextIndex();
    indexUnderTest.notice('first', 1);
    indexUnderTest.notice('second', 2);
    indexUnderTest.notice('third', 3);

    expect(indexUnderTest.container.index.length).toEqual(3);
    expect(indexUnderTest.container.index[0]).toEqual({ id: 'first', timestamp: 1 });
    expect(indexUnderTest.container.index[1]).toEqual({ id: 'second', timestamp: 2 });
    expect(indexUnderTest.container.index[2]).toEqual({ id: 'third', timestamp: 3 });
  });

  test('notice updates timestamp', async () => {
    const indexUnderTest = new ContextIndex();
    indexUnderTest.notice('first', 1);
    indexUnderTest.notice('second', 2);
    expect(indexUnderTest.container.index.length).toEqual(2);
    expect(indexUnderTest.container.index[0]).toEqual({ id: 'first', timestamp: 1 });
    expect(indexUnderTest.container.index[1]).toEqual({ id: 'second', timestamp: 2 });

    indexUnderTest.notice('first', 3);
    indexUnderTest.notice('second', 4);
    expect(indexUnderTest.container.index.length).toEqual(2);
    expect(indexUnderTest.container.index[0]).toEqual({ id: 'first', timestamp: 3 });
    expect(indexUnderTest.container.index[1]).toEqual({ id: 'second', timestamp: 4 });
  });

  test('prune oldest down to maximum', async () => {
    const indexUnderTest = new ContextIndex();
    indexUnderTest.notice('first', 50);
    indexUnderTest.notice('second', 1);
    indexUnderTest.notice('third', 2);
    indexUnderTest.notice('fourth', 51);
    expect(indexUnderTest.container.index.length).toEqual(4);

    indexUnderTest.prune(2);
    expect(indexUnderTest.container.index.length).toEqual(2);
    expect(indexUnderTest.container.index[0]).toEqual({ id: 'first', timestamp: 50 });
    expect(indexUnderTest.container.index[1]).toEqual({ id: 'fourth', timestamp: 51 });
  });

  test('prune oldest down to 0', async () => {
    const indexUnderTest = new ContextIndex();
    indexUnderTest.notice('first', 50);
    indexUnderTest.notice('second', 1);
    indexUnderTest.notice('third', 2);
    indexUnderTest.notice('fourth', 51);
    expect(indexUnderTest.container.index.length).toEqual(4);

    indexUnderTest.prune(0);
    expect(indexUnderTest.container.index.length).toEqual(0);
  });

  test('prune negative number', async () => {
    const indexUnderTest = new ContextIndex();
    indexUnderTest.notice('first', 50);
    indexUnderTest.notice('second', 1);
    indexUnderTest.notice('third', 2);
    indexUnderTest.notice('fourth', 51);
    expect(indexUnderTest.container.index.length).toEqual(4);

    indexUnderTest.prune(-1);
    expect(indexUnderTest.container.index.length).toEqual(0);
  });

  test('prune two entries have same timestamp', async () => {
    const indexUnderTest = new ContextIndex();
    indexUnderTest.notice('first', 1);
    indexUnderTest.notice('second', 1);
    expect(indexUnderTest.container.index.length).toEqual(2);

    indexUnderTest.prune(1);
    expect(indexUnderTest.container.index.length).toEqual(1);
    expect(indexUnderTest.container.index[0].id).toEqual('second');
  });

  test('toJson', async () => {
    const indexUnderTest = new ContextIndex();
    indexUnderTest.notice('first', 1);
    indexUnderTest.notice('second', 2);
    indexUnderTest.notice('third', 3);

    const output = indexUnderTest.toJson();
    expect(output).toEqual(
      '{"index":[{"id":"first","timestamp":1},{"id":"second","timestamp":2},{"id":"third","timestamp":3}]}',
    );
  });

  test('fromJson valid', async () => {
    const input =
      '{"index":[{"id":"first","timestamp":1},{"id":"second","timestamp":2},{"id":"third","timestamp":3}]}';
    const indexUnderTest = ContextIndex.fromJson(input);
    expect(indexUnderTest.container.index.length).toEqual(3);
    expect(indexUnderTest.container.index[0]).toEqual({ id: 'first', timestamp: 1 });
    expect(indexUnderTest.container.index[1]).toEqual({ id: 'second', timestamp: 2 });
    expect(indexUnderTest.container.index[2]).toEqual({ id: 'third', timestamp: 3 });
  });

  test('fromJson invalid', async () => {
    const input = 'My name is Json.  I am invalid.';
    const indexUnderTest = ContextIndex.fromJson(input);
    expect(indexUnderTest.container.index.length).toEqual(0);
  });
});
