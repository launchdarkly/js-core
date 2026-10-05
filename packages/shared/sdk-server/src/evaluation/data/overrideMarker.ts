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
 */
export interface OverrideMarkable {
  /**
   * True when this definition was supplied by an override source rather than by LaunchDarkly.
   *
   * This field is not part of the data model and is never serialized. Only the SDK's override
   * store sets it, on the entries it holds. Evaluation reads it to mark the evaluations that read
   * the definition. Other readers can treat a marked definition the same as any other.
   */
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

/**
 * Removes the override marker from an entity in place. The key is reserved for the override
 * store, so a definition that arrives with it from any other source has it removed as the
 * definition is prepared.
 *
 * @internal
 */
export function stripOverrideMarker(item: OverrideMarkable): void {
  delete item._sdk_override;
}
