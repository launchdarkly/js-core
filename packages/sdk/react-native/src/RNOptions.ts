import { ConnectionMode, LDOptions } from '@launchdarkly/js-client-sdk-common';

/**
 * Interface for providing custom storage implementations for react Native.
 *
 * This interface should only be used when customizing the storage mechanism
 * used by the SDK. Typical usage of the SDK does not require implementing
 * this interface.
 *
 * Implementations may not throw exceptions.
 *
 * The SDK assumes that the persistence is only being used by a single instance
 * of the SDK per SDK key (two different SDK instances, with 2 different SDK
 * keys could use the same persistence instance).
 *
 * The SDK, with correct usage, will not have overlapping writes to the same
 * key.
 *
 * This interface does not depend on the ability to list the contents of the
 * store or namespaces. This is to maintain the simplicity of implementing a
 * key-value store on many platforms.
 */
export interface RNStorage {
  /**
   * Implementation Note: This is the same as the platform storage interface.
   * The implementation is duplicated to avoid exposing the internal platform
   * details from implementors. This allows for us to modify the internal
   * interface without breaking external implementations.
   */

  /**
   * Get a value from the storage.
   *
   * @param key The key to get a value for.
   * @returns A promise which resolves to the value for the specified key, or
   * null if there is no value for the key.
   */
  get: (key: string) => Promise<string | null>;

  /**
   * Set the given key to the specified value.
   *
   * @param key The key to set a value for.
   * @param value The value to set for the key.
   * @returns A promise that resolves after the operation completes.
   */
  set: (key: string, value: string) => Promise<void>;

  /**
   * Clear the value associated with a given key.
   *
   * After clearing a key subsequent calls to the get function should return
   * null for that key.
   *
   * @param key The key to clear the value for.
   * @returns A promise that resolves after that operation completes.
   */
  clear: (key: string) => Promise<void>;
}

export interface RNSpecificOptions {
  /**
   * Some platforms (windows, web, mac, linux) can continue executing code
   * in the background.
   *
   * Defaults to false.
   */
  readonly runInBackground?: boolean;

  /**
   * Enable handling of network availability. When this is true the
   * connection state will automatically change when network
   * availability changes.
   *
   * Defaults to true.
   */
  readonly automaticNetworkHandling?: boolean;

  /**
   * Enable handling associated with transitioning between the foreground
   * and background.
   *
   * Defaults to true.
   */
  readonly automaticBackgroundHandling?: boolean;

  /**
   * Custom storage implementation.
   *
   * Typical SDK usage will not involve using customized storage.
   *
   * Storage is used used for caching flag values for context as well as persisting generated
   * identifiers. Storage could be used for additional features in the future.
   *
   * Defaults to @react-native-async-storage/async-storage.
   */
  readonly storage?: RNStorage;

  /**
   * Sets the mode to use for connections when the SDK is initialized.
   *
   * @remarks
   * Possible values are offline, streaming, or polling. See {@link ConnectionMode} for more information.
   *
   * @defaultValue streaming.
   */
  initialConnectionMode?: ConnectionMode;
}

export default interface RNOptions extends LDOptions, RNSpecificOptions {}
