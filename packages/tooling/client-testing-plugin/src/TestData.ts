import type {
  LDDebugOverride,
  LDPluginBase,
  LDPluginEnvironmentMetadata,
  LDPluginMetadata,
} from '@launchdarkly/js-client-sdk-common';

import TestDataFlagBuilder from './TestDataFlagBuilder';

const PLUGIN_NAME = 'test-data';

const hasOwn = (obj: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(obj, key);

function isPrimitive(v: unknown): boolean {
  if (v === null) return true;
  const t = typeof v;
  return t !== 'object' && t !== 'function';
}

/**
 * A mechanism for providing dynamically updatable feature flag state in a
 * simplified form to an SDK client in test scenarios.
 *
 * TestData integrates with the SDK as a plugin and uses the experimental debug
 * override mechanism (PLUGIN spec `registerDebug`) to inject flag values.
 * Unlike streaming or polling data sources that connect to LaunchDarkly
 * services, TestData allows developers to programmatically define flag values
 * and update them during test execution without any network I/O.
 *
 * **Primary use cases:**
 * - Unit tests that need predictable flag evaluation behavior
 * - Integration tests that simulate various flag configurations
 * - Local development environments without LaunchDarkly connectivity
 *
 * **Important:** TestData is intended exclusively for testing and development
 * scenarios. It should not be used in production environments.
 *
 * **One TestData per client.** Pass each `TestData` to at most one SDK client.
 * Sharing one across multiple clients (or reusing across tests without
 * `clear()`) bleeds previously-configured flags into the next client. Either
 * construct a fresh `TestData` per test or call `td.clear()` in `beforeEach`.
 *
 * @example
 * ```typescript
 * import { TestData } from '@launchdarkly/client-testing-plugin';
 * import { createClient } from '@launchdarkly/js-client-sdk';
 *
 * const td = new TestData();
 * td.update(td.flag('flag-key-1').booleanFlag().variationForAll(true));
 *
 * const client = createClient('test-key', context, {
 *   plugins: [td],
 *   sendEvents: false,
 *   streaming: false,
 * });
 * await client.start({ bootstrap: {} });
 *
 * // Flags can be updated at any time:
 * td.update(td.flag('flag-key-1').variationForAll(false));
 * ```
 */
export default class TestData implements LDPluginBase<unknown, unknown> {
  private _currentBuilders: Record<string, TestDataFlagBuilder> = Object.create(null);
  private _currentValues: Record<string, unknown> = Object.create(null);
  private _debugOverride?: LDDebugOverride;

  /**
   * Creates or copies a {@link TestDataFlagBuilder} for building a test flag
   * configuration.
   *
   * If the flag key has already been defined in this `TestData` instance,
   * then the builder starts with the same configuration that was last
   * provided for this flag.
   *
   * Otherwise, it starts with a new default configuration in which the flag
   * has `true` and `false` variations, is `true` for all contexts when
   * targeting is turned on and `false` otherwise, and currently has targeting
   * turned on.
   *
   * Once you have set the desired configuration, pass the builder to
   * {@link TestData.update}.
   *
   * @param key the flag key
   * @returns a flag configuration builder
   */
  flag(key: string): TestDataFlagBuilder {
    if (hasOwn(this._currentBuilders, key)) {
      return this._currentBuilders[key].clone();
    }
    return new TestDataFlagBuilder(key).booleanFlag();
  }

  /**
   * Updates the test data with the specified flag configuration.
   *
   * This immediately propagates the flag change to any `LDClient` instance
   * that you have already configured to use this `TestData`. If no `LDClient`
   * has been started yet, it simply adds this flag to the test data which will
   * be provided to any `LDClient` that you subsequently configure.
   *
   * If the resolved value is identical to the previous value for this key
   * AND both values are primitives, no change event is emitted (a small
   * optimization to avoid waking listeners on no-op updates). Object/array
   * values always propagate so that in-place mutations are not silently
   * dropped.
   *
   * @param flagBuilder a flag configuration builder
   */
  update(flagBuilder: TestDataFlagBuilder): void {
    const key = flagBuilder.getKey();
    const value = flagBuilder.resolve();
    const hadPrevious = hasOwn(this._currentValues, key);
    const previous = hadPrevious ? this._currentValues[key] : undefined;

    this._currentBuilders[key] = flagBuilder.clone();
    this._currentValues[key] = value;

    const isNoop =
      hadPrevious && isPrimitive(previous) && isPrimitive(value) && previous === value;
    if (this._debugOverride && !isNoop) {
      this._debugOverride.setOverride(key, value);
    }
  }

  /**
   * Removes the flag with the given key from this TestData instance. If a
   * client is connected, the override for this flag is also cleared.
   *
   * @param key the flag key to remove
   */
  removeFlag(key: string): void {
    delete this._currentBuilders[key];
    delete this._currentValues[key];
    this._debugOverride?.removeOverride(key);
  }

  /**
   * Removes all flags from this TestData instance. If a client is connected,
   * all overrides are cleared. Useful for test isolation in `beforeEach`.
   */
  clear(): void {
    this._currentBuilders = Object.create(null);
    this._currentValues = Object.create(null);
    this._debugOverride?.clearAllOverrides();
  }

  // -- Plugin interface (LDPluginBase) --

  getMetadata(): LDPluginMetadata {
    return { name: PLUGIN_NAME };
  }

  register(_client: unknown, _environmentMetadata: LDPluginEnvironmentMetadata): void {
    // No-op: this plugin only needs the LDDebugOverride handed to registerDebug.
  }

  /**
   * @experimental
   *
   * A given `TestData` instance must be paired with at most one client.
   * Calling `registerDebug` a second time throws — construct a separate
   * `TestData` for each client.
   */
  registerDebug(debugOverride: LDDebugOverride): void {
    if (this._debugOverride) {
      throw new Error(
        'TestData has already been registered with a client. Construct a separate ' +
          'TestData instance for each client (or call clear() between tests).',
      );
    }
    this._debugOverride = debugOverride;

    Object.keys(this._currentValues).forEach((key) => {
      debugOverride.setOverride(key, this._currentValues[key]);
    });
  }
}
