import type { TrackingEventDetails } from '@openfeature/server-sdk';

/**
 * Translate {@link TrackingEventDetails} to an object suitable for use as the data
 * parameter in LDClient.track().
 *
 * The value attribute will be removed and if the resulting object is empty,
 * returns undefined.
 *
 */
export function translateTrackingEventDetails(
  details: TrackingEventDetails,
): Record<string, unknown> | undefined {
  const { value, ...data } = details;
  return Object.keys(data).length ? data : undefined;
}
