import type {
  LDDebugOverride,
  LDFlagValue,
  LDPluginBase,
  LDPluginEnvironmentMetadata,
  LDPluginMetadata,
} from '@launchdarkly/js-client-sdk-common';

const PLUGIN_NAME = 'test-data';

const hasOwn = (obj: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(obj, key);

/**
 * A mechanism for providing dynamically updatable feature flag values to an
 * SDK client in test scenarios.
 *
 * `TestData` integrates with the SDK as a plugin and uses the
 * debug override mechanism to inject flag values. Unlike streaming or polling
 * data sources that connect to LaunchDarkly services, `TestData` lets you
 * define flag values in code and update them during test execution without
 * any network I/O.
 *
 * **Primary use cases:**
 * - Unit tests that need predictable flag evaluation behavior
 * - Integration tests that simulate various flag configurations
 * - Local development environments without LaunchDarkly connectivity
 *
 * **Important:** `TestData` is intended exclusively for testing and
 * development scenarios. It must not be used in production environments.
 *
 * @example
 * ```typescript
 * import { TestData } from '@launchdarkly/client-testing-plugin';
 * import { createClient } from '@launchdarkly/js-client-sdk';
 *
 * const td = new TestData({
 *   'show-banner': true,
 *   greeting: 'Hello',
 * });
 *
 * const client = createClient('test-key', context, {
 *   plugins: [td],
 *   sendEvents: false,
 *   streaming: false,
 * });
 * await client.start({ bootstrap: {} });
 *
 * // Update flag values at any time:
 * td.setBool('show-banner', false).setString('greeting', 'Welcome');
 * ```
 */
export default class TestData implements LDPluginBase<unknown, unknown> {
  private _values: Record<string, LDFlagValue> = Object.create(null);
  private _debugOverride?: LDDebugOverride;

  /**
   * Creates a new TestData instance, optionally seeded with a base set of
   * flag values. The seed values are applied to the SDK client when it
   * initializes.
   *
   * @param initialFlags optional map of flag keys to values
   */
  constructor(initialFlags?: { [key: string]: LDFlagValue }) {
    if (initialFlags) {
      Object.entries(initialFlags).forEach(([key, value]) => {
        this._values[key] = value;
      });
    }
  }

  /**
   * Sets a boolean flag value.
   *
   * @returns this TestData for chaining
   */
  setBool(key: string, value: boolean): this {
    return this._set(key, value);
  }

  /**
   * Sets a string flag value.
   *
   * @returns this TestData for chaining
   */
  setString(key: string, value: string): this {
    return this._set(key, value);
  }

  /**
   * Sets a numeric flag value.
   *
   * @returns this TestData for chaining
   */
  setNumber(key: string, value: number): this {
    return this._set(key, value);
  }

  /**
   * Sets a JSON flag value (object or array).
   *
   * Updates dedup by reference equality. Pass a fresh object/array reference
   * if you want a `change` event to fire after mutating the previously-set
   * value.
   *
   * @returns this TestData for chaining
   */
  setJson(key: string, value: object | unknown[]): this {
    if (value === null || typeof value !== 'object') {
      throw new TypeError(
        `setJson("${key}", ...) requires an object or array; got ${value === null ? 'null' : typeof value}`,
      );
    }
    return this._set(key, value);
  }

  /**
   * Removes the flag with the given key. If the SDK client is connected,
   * the override for this flag is also cleared.
   *
   * @returns this TestData for chaining
   */
  remove(key: string): this {
    delete this._values[key];
    this._debugOverride?.removeOverride(key);
    return this;
  }

  /**
   * Removes all flags. If the SDK client is connected, all overrides are
   * cleared. Useful for test isolation in `beforeEach`.
   *
   * @returns this TestData for chaining
   */
  clear(): this {
    this._values = Object.create(null);
    this._debugOverride?.clearAllOverrides();
    return this;
  }

  getMetadata(): LDPluginMetadata {
    return { name: PLUGIN_NAME };
  }

  register(_client: unknown, _environmentMetadata: LDPluginEnvironmentMetadata): void {
    // No-op: this plugin only needs the LDDebugOverride handed to registerDebug.
  }

  /**
   * A given `TestData` instance must be paired with at most one client.
   * Calling `registerDebug` a second time throws. The SDK plugin runner
   * catches this throw and logs an error rather than failing initialization,
   * so the second client will silently still work but will not receive
   * subsequent flag updates from this `TestData`.
   */
  registerDebug(debugOverride: LDDebugOverride): void {
    if (this._debugOverride) {
      throw new Error(
        'TestData has already been registered with a client. ' +
          'Construct a separate TestData instance for each client.',
      );
    }
    this._debugOverride = debugOverride;

    Object.keys(this._values).forEach((key) => {
      debugOverride.setOverride(key, this._values[key]);
    });
  }

  /**
   * @internal
   *
   * Shared write path for the typed setters. Stores the value, then fires
   * `setOverride` unless this is a no-op primitive write (same key, same
   * primitive value as before). Object/array writes always fire.
   */
  private _set(key: string, value: LDFlagValue): this {
    const hadPrevious = hasOwn(this._values, key);
    const previous = hadPrevious ? this._values[key] : undefined;

    this._values[key] = value;

    const isNoop = hadPrevious && Object.is(previous, value);
    if (this._debugOverride && !isNoop) {
      this._debugOverride.setOverride(key, value);
    }
    return this;
  }
}
