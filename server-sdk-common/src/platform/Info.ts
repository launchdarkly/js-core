/**
 * Information about the platform of the SDK and the environment it is executing.
 */
export interface PlatformData {
  /**
   * Information about the OS on which the SDK is running. Should be populated
   * when available. Not all platforms will make this data accessible.
   */
  os?: {
    /**
     * The architecture. Ideally at runtime, but may be build time if that is
     * a constraint.
     */
    arch?: string;
    /**
     * The name of the OS. "MacOS", "Windows", or "Linux". If not one of those,
     * then use the value provided by the OS.
     */
    name?: string;

    /** The version of the OS. */
    version?: string;
  }

  /**
   * The name of the platform the SDK is running on. For instance 'Node'.
   */
  name?: string;
  /**
   * The version of the platform the SDK is running on. e.g. "13.1.0".
   */
  version?: string;

  /**
   * Any additional attributes associated with the platform.
   */
  additional: Record<string, string>;
}

export interface SdkData {
  /**
   * The name of the SDK. e.g. "node-server-sdk"
   */
  name?: string;

  /**
   * The version of the SDK.
   */
  version?: string;

  /**
   * Name of the wrapper SDK if present.
   */
  wrapperName?: string;
  /**
   * Version of the wrapper if present.
   */
  wrapperVersion?: string;
}

/**
 * Interface for getting information about the SDK or the environment it is
 * executing in.
 */
export default interface Info {
  /**
   * Get information about the platform.
   */
  platformData(): PlatformData;

  /**
   * Get information about the SDK implementation.
   */
  sdkData(): SdkData;
}
