/* eslint-disable no-underscore-dangle */
import { LDEvaluationReason } from '@launchdarkly/js-sdk-common';

/**
 * The override marker is carried on flag and segment definitions under a reserved, namespaced
 * key, so it cannot collide with a current or future data model field. Only this module names
 * the key. Other code reads and strips the marker through these functions.
 *
 * Flag overrides are currently experimental and subject to change.
 */

/**
 * An entity that can carry the override marker. The interface is part of the Flag and Segment
 * types and so of the emitted typings; the marker itself is only ever set by the SDK.
 */
export interface OverrideMarkable {
  /**
   * True when this definition was supplied by an override source rather than by LaunchDarkly.
   *
   * This field is not part of the data model, and the SDK's serializers leave it out. Only the
   * SDK's override store sets it, on the entries it holds. Evaluation reads it to mark the
   * evaluations that read the definition. Other readers can treat a marked definition the same
   * as any other.
   */
  _sdk_override?: boolean;
}

// The marker counts only as an own property that is exactly true. A key inherited through the
// prototype, or a value of another type, is not a marker: the strip below removes own keys only,
// so a definition that arrived with such a key must not read as an override.
function ownMarker(value: unknown): boolean | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  if (!Object.prototype.hasOwnProperty.call(value, '_sdk_override')) {
    return undefined;
  }
  return (value as OverrideMarkable)._sdk_override;
}

/**
 * Reports whether the definition came from the override store.
 *
 * @internal
 */
export function isOverrideEntry(item: OverrideMarkable | undefined | null): boolean {
  return ownMarker(item) === true;
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
  return ownMarker(value) !== undefined;
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
 * definition is prepared. A value that is not an object, such as a null entry in a payload, is
 * left to the caller's own handling.
 *
 * @internal
 */
export function stripOverrideMarker(item: OverrideMarkable | undefined | null): void {
  if (typeof item === 'object' && item !== null) {
    delete item._sdk_override;
  }
}

/**
 * Returns a copy of an evaluation reason with the override indicator set.
 */
export function markOverrideAffected(reason: LDEvaluationReason): LDEvaluationReason {
  return { ...reason, overrideAffected: true };
}
