/* eslint-disable no-underscore-dangle */
import {
  hasOverrideMarker,
  isOverrideEntry,
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
