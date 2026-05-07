import { LDFlagValue } from '@launchdarkly/js-sdk-common';

import { ItemDescriptor } from '../flag-manager/ItemDescriptor';

/**
 * Debug interface for plugins that need to override flag values during development.
 * This interface provides methods to temporarily override flag values that take
 * precedence over the actual flag values from LaunchDarkly. These overrides are
 * useful for testing, development, and debugging scenarios.
 *
 * @experimental This interface is experimental and intended for use by LaunchDarkly tools at this time.
 * The API may change in future versions.
 */
export interface LDDebugOverride {
  /**
   * Set an override value for a flag that takes precedence over the real flag value.
   *
   * @param flagKey The flag key.
   * @param value The override value.
   */
  setOverride(flagKey: string, value: LDFlagValue): void;

  /**
   * Remove an override value for a flag, reverting to the real flag value.
   *
   * @param flagKey The flag key.
   */
  removeOverride(flagKey: string): void;

  /**
   * Clear all override values, reverting all flags to their real values.
   */
  clearAllOverrides(): void;

  /**
   * Get all currently active flag overrides.
   *
   * @returns
   *   An object containing all active overrides as key-value pairs,
   *   where keys are flag keys and values are the overridden flag values.
   *   Returns an empty object if no overrides are active.
   */
  getAllOverrides(): { [key: string]: ItemDescriptor };
}
