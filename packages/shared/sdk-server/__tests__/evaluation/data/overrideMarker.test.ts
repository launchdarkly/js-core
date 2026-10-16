/* eslint-disable no-underscore-dangle */
import {
  hasOverrideMarker,
  isOverrideEntry,
  stripOverrideMarker,
  withoutOverrideMarker,
} from '../../../src/evaluation/data/overrideMarker';

it('reports a marked entry as an override entry', () => {
  expect(isOverrideEntry({ _sdk_override: true })).toBe(true);
});

it('reports an unmarked entry as not an override entry', () => {
  expect(isOverrideEntry({})).toBe(false);
  expect(isOverrideEntry({ _sdk_override: false })).toBe(false);
  expect(isOverrideEntry(undefined)).toBe(false);
  expect(isOverrideEntry(null)).toBe(false);
});

it('detects the marker key on objects only', () => {
  expect(hasOverrideMarker({ _sdk_override: true })).toBe(true);
  expect(hasOverrideMarker({ _sdk_override: false })).toBe(true);
  expect(hasOverrideMarker({ key: 'flag' })).toBe(false);
  expect(hasOverrideMarker(null)).toBe(false);
  expect(hasOverrideMarker('text')).toBe(false);
  expect(hasOverrideMarker(7)).toBe(false);
});

it('copies an entity without the marker and leaves the entity marked', () => {
  const entity = { key: 'flag', version: 2, _sdk_override: true };
  const copy = withoutOverrideMarker(entity);

  expect(copy).toEqual({ key: 'flag', version: 2 });
  expect(copy).not.toHaveProperty('_sdk_override');
  expect(entity._sdk_override).toBe(true);
});

it('reads the marker only as an own property that is exactly true', () => {
  // A definition can inherit the key through its prototype, for example when a payload that
  // carries a "__proto__" entry is copied with assignment semantics. The strip removes own keys
  // only, so an inherited key must not read as a marker. Neither must a value of another type.
  const inherited = Object.assign(Object.create({ _sdk_override: true }), { key: 'f' });
  expect(inherited._sdk_override).toBe(true);
  expect(isOverrideEntry(inherited)).toBe(false);
  expect(hasOverrideMarker(inherited)).toBe(false);
  const copied = Object.assign(
    {},
    JSON.parse('{"key": "f", "__proto__": {"_sdk_override": true}}'),
  );
  expect(isOverrideEntry(copied)).toBe(false);
  expect(isOverrideEntry({ key: 'f', _sdk_override: 'yes' } as any)).toBe(false);
  expect(hasOverrideMarker({ key: 'f', _sdk_override: 'yes' } as any)).toBe(true);
  expect(isOverrideEntry({ key: 'f', _sdk_override: true } as any)).toBe(true);
});

it('strips nothing from a value that is not an object', () => {
  expect(() => stripOverrideMarker(null)).not.toThrow();
  expect(() => stripOverrideMarker(undefined)).not.toThrow();
});
