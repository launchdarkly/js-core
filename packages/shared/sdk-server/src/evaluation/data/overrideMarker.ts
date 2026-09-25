/* eslint-disable no-underscore-dangle */

/**
 * The override marker is carried on flag and segment definitions under a reserved, namespaced
 * key, so it cannot collide with a current or future data model field. Only this module names
 * the key. Other code reads and strips the marker through these functions.
 *
 * Flag overrides are currently experimental and subject to change.
 */

/**
 * An entity that can carry the override marker.
 *
 * @internal
 */
export interface OverrideMarkable {
  _sdk_override?: boolean;
}

/**
 * Reports whether the definition came from the override store.
 *
 * @internal
 */
export function isOverrideEntry(item: OverrideMarkable | undefined | null): boolean {
  return !!item?._sdk_override;
}

/**
 * Marks an entity as an override entry. Only the override store calls this, on copies that it
 * owns.
 *
 * @internal
 */
export function markOverrideEntry<T extends OverrideMarkable>(item: T): T {
  item._sdk_override = true;
  return item;
}

/**
 * Reports whether a value carries the override marker key at all.
 *
 * @internal
 */
export function hasOverrideMarker(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as OverrideMarkable)._sdk_override !== undefined
  );
}

/**
 * Returns a shallow copy of an entity without the override marker. The entity itself keeps
 * the marker.
 *
 * @internal
 */
export function withoutOverrideMarker<T extends OverrideMarkable>(item: T): T {
  const copy = { ...item };
  delete copy._sdk_override;
  return copy;
}
