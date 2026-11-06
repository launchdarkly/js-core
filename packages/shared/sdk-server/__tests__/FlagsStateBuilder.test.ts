import { Flag } from '../src/evaluation/data/Flag';
import FlagsStateBuilder from '../src/FlagsStateBuilder';

function flagWithKey(key: string): Flag {
  return {
    key,
    version: 1,
    on: true,
    fallthrough: { variation: 0 },
    variations: [`value of ${key}`],
  };
}

it('includes flags whose keys are names of built-in object members', () => {
  const builder = new FlagsStateBuilder(true, false);
  const keys = ['__proto__', 'constructor', 'hasOwnProperty', 'toString', 'valueOf'];
  keys.forEach((key) => {
    builder.addFlag(
      flagWithKey(key),
      `value of ${key}`,
      0,
      { kind: 'FALLTHROUGH' },
      false,
      false,
      undefined,
      false,
    );
  });

  // Build the state and serialize it as bootstrap data would be.
  const state = builder.build();
  const json = JSON.parse(JSON.stringify(state));

  // Every flag is present as its own key, including __proto__.
  expect(Object.keys(state.allValues()).sort()).toEqual([...keys].sort());
  keys.forEach((key) => {
    expect(state.getFlagValue(key)).toEqual(`value of ${key}`);
    expect(json[key]).toEqual(`value of ${key}`);
    expect(json.$flagsState[key]).toEqual({ variation: 0, version: 1 });
  });
});

it('does not report built-in object members as flags that are not in the state', () => {
  const state = new FlagsStateBuilder(true, true).build();

  // Look up keys that no flag in the state has.
  const value = state.getFlagValue('constructor');
  const reason = state.getFlagReason('toString');
  // Neither lookup finds an inherited property.
  expect(value).toBeUndefined();
  expect(reason).toBeNull();
});

it('serializes the state to plain objects', () => {
  const builder = new FlagsStateBuilder(true, false);
  builder.addFlag(
    flagWithKey('flag-key'),
    'value of flag-key',
    0,
    { kind: 'FALLTHROUGH' },
    false,
    false,
    undefined,
    false,
  );

  // Get the state as an object, as a framework that passes bootstrap data on does.
  const json = builder.build().toJSON() as Record<string, any>;
  // The state and its metadata have the normal object prototype.
  expect(Object.getPrototypeOf(json)).toBe(Object.prototype);
  expect(Object.getPrototypeOf(json.$flagsState)).toBe(Object.prototype);
});
