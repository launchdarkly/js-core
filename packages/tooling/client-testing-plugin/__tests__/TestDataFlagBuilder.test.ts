import TestDataFlagBuilder from '../src/TestDataFlagBuilder';

describe('TestDataFlagBuilder', () => {
  it('creates a default boolean flag that resolves to true', () => {
    expect(new TestDataFlagBuilder('test-flag').booleanFlag().resolve()).toBe(true);
  });

  it('returns false when targeting is off', () => {
    expect(new TestDataFlagBuilder('test-flag').booleanFlag().on(false).resolve()).toBe(false);
  });

  it('sets variationForAll with boolean true', () => {
    expect(
      new TestDataFlagBuilder('test-flag').booleanFlag().variationForAll(true).resolve(),
    ).toBe(true);
  });

  it('sets variationForAll with boolean false', () => {
    expect(
      new TestDataFlagBuilder('test-flag').booleanFlag().variationForAll(false).resolve(),
    ).toBe(false);
  });

  it('sets valueForAll with any value', () => {
    expect(new TestDataFlagBuilder('test-flag').valueForAll('hello').resolve()).toBe('hello');
  });

  it('stringFlag resolves to the supplied string', () => {
    expect(new TestDataFlagBuilder('test-flag').stringFlag('hello').resolve()).toBe('hello');
  });

  it('stringFlag preserves a chained on(false)', () => {
    expect(new TestDataFlagBuilder('test-flag').stringFlag('hello').on(false).resolve()).toBe(
      'hello',
    );
  });

  it('numberFlag resolves to the supplied number', () => {
    expect(new TestDataFlagBuilder('test-flag').numberFlag(42).resolve()).toBe(42);
  });

  it('numberFlag preserves a chained on(false)', () => {
    expect(new TestDataFlagBuilder('test-flag').numberFlag(42).on(false).resolve()).toBe(42);
  });

  it('jsonFlag resolves to the supplied object', () => {
    expect(new TestDataFlagBuilder('test-flag').jsonFlag({ a: 1 }).resolve()).toEqual({ a: 1 });
  });

  it('jsonFlag preserves a chained on(false)', () => {
    expect(
      new TestDataFlagBuilder('test-flag').jsonFlag({ a: 1 }).on(false).resolve(),
    ).toEqual({ a: 1 });
  });

  it('jsonFlag accepts both objects and arrays', () => {
    expect(new TestDataFlagBuilder('test-flag').jsonFlag({ a: 1 }).resolve()).toEqual({ a: 1 });
    expect(new TestDataFlagBuilder('test-flag').jsonFlag([1, 2, 3]).resolve()).toEqual([1, 2, 3]);
  });

  it('valueForAll returns the value regardless of targeting state', () => {
    // valueForAll must NOT mutate `on`; the value resolves the same in both states.
    const onBuilder = new TestDataFlagBuilder('test-flag').on(true).valueForAll('v');
    const offBuilder = new TestDataFlagBuilder('test-flag').on(false).valueForAll('v');

    expect(onBuilder.resolve()).toBe('v');
    expect(offBuilder.resolve()).toBe('v');
  });

  it('supports custom variations with numeric index', () => {
    expect(
      new TestDataFlagBuilder('test-flag')
        .variations('red', 'green', 'blue')
        .on(true)
        .fallthroughVariation(2)
        .resolve(),
    ).toBe('blue');
  });

  it('uses off variation when targeting is off with custom variations', () => {
    expect(
      new TestDataFlagBuilder('test-flag')
        .variations('red', 'green', 'blue')
        .on(false)
        .offVariation(1)
        .resolve(),
    ).toBe('green');
  });

  it('creates independent copies with clone', () => {
    const builder = new TestDataFlagBuilder('test-flag').booleanFlag().variationForAll(true);
    const clone = builder.clone();

    clone.variationForAll(false);

    expect(builder.resolve()).toBe(true);
    expect(clone.resolve()).toBe(false);
  });

  it('returns the correct key', () => {
    const builder = new TestDataFlagBuilder('my-key');
    expect(builder.getKey()).toBe('my-key');
  });

  it('converts boolean fallthroughVariation to a boolean flag', () => {
    expect(
      new TestDataFlagBuilder('test-flag')
        .variations('a', 'b')
        .fallthroughVariation(true)
        .resolve(),
    ).toBe(true);
  });

  it('converts boolean offVariation to a boolean flag', () => {
    expect(
      new TestDataFlagBuilder('test-flag')
        .variations('a', 'b')
        .offVariation(true)
        .on(false)
        .resolve(),
    ).toBe(true);
  });

  it('throws when fallthrough is unset', () => {
    expect(() => new TestDataFlagBuilder('test-flag').variations('a').resolve()).toThrow(
      /no fallthrough variation/,
    );
  });

  it('throws when off variation is unset and targeting is off', () => {
    expect(() =>
      new TestDataFlagBuilder('test-flag').variations('a').on(false).fallthroughVariation(0).resolve(),
    ).toThrow(/no off variation/);
  });

  it('throws when fallthrough index is out of bounds', () => {
    expect(() =>
      new TestDataFlagBuilder('test-flag').variations('a', 'b').fallthroughVariation(5).resolve(),
    ).toThrow(/out of bounds/);
  });
});
