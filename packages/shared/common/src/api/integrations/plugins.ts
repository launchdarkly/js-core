/**
 * Meta-data about a plugin implementation.
 *
 * May be used in logs and analytics to identify the plugin.
 */
export interface LDPluginMetadata {
  /**
   * The name of the plugin.
   */
  readonly name: string;
}

/**
 * Metadata about the SDK that is running the plugin.
 */
export interface LDPluginSdkMetadata {
  /**
   * The name of the SDK.
   */
  readonly name: string;

  /**
   * The version of the SDK.
   */
  readonly version: string;

  /**
   * If this is a wrapper SDK, then this is the name of the wrapper.
   */
  readonly wrapperName?: string;

  /**
   * If this is a wrapper SDK, then this is the version of the wrapper.
   */
  readonly wrapperVersion?: string;
}

/**
 * Metadata about the application where the LaunchDarkly SDK is running.
 */
export interface LDPluginApplicationMetadata {
  /**
   * A unique identifier representing the application where the LaunchDarkly SDK is running.
   *
   * This can be specified as any string value as long as it only uses the following characters: ASCII letters,
   * ASCII digits, period, hyphen, underscore. A string containing any other characters will be ignored.
   *
   * Example: `authentication-service`
   */
  readonly id?: string;
  /**
   * A unique identifier representing the version of the application where the LaunchDarkly SDK is running.
   *
   * This can be specified as any string value as long as it only uses the following characters: ASCII letters,
   * ASCII digits, period, hyphen, underscore. A string containing any other characters will be ignored.
   *
   * Example: `1.0.0` (standard version string) or `abcdef` (sha prefix)
   */
  readonly version?: string;

  /**
   * A human-friendly application name representing the application where the LaunchDarkly SDK is running.
   *
   * This can be specified as any string value as long as it only uses the following characters: ASCII letters,
   * ASCII digits, period, hyphen, underscore. A string containing any other characters will be ignored.
   */
  readonly name?: string;

  /**
   * A human-friendly name representing the version of the application where the LaunchDarkly SDK is running.
   *
   * This can be specified as any string value as long as it only uses the following characters: ASCII letters,
   * ASCII digits, period, hyphen, underscore. A string containing any other characters will be ignored.
   */
  readonly versionName?: string;
}

/**
 * Metadata about the environment where the plugin is running.
 */
export interface LDPluginEnvironmentMetadata {
  /**
   * Metadata about the SDK that is running the plugin.
   */
  readonly sdk: LDPluginSdkMetadata;

  /**
   * Metadata about the application where the LaunchDarkly SDK is running.
   *
   * Only present if any application information is available.
   */
  readonly application?: LDPluginApplicationMetadata;

  /**
   * Present if the SDK is a client-side SDK running in a web environment.
   */
  readonly clientSideId?: string;

  /**
   * Present if the SDK is a client-side SDK running in a mobile environment.
   */
  readonly mobileKey?: string;

  /**
   * Present if the SDK is a server-side SDK.
   */
  readonly sdkKey?: string;
}

/**
 * Interface for plugins to the LaunchDarkly SDK.
 *
 * This is the base interface common to client-side and server-side SDKs. This interface should be re-exported by SDKs
 * using the specific SDK's client type for the `TClient` parameter, and the specific SDK's hook type for the `THook` parameter.
 */
export interface LDPluginBase<TClient, THook> {
  /**
   * Get metadata about the plugin.
   */
  getMetadata(): LDPluginMetadata;

  /**
   * Registers the plugin with the SDK. Called once during SDK initialization.
   *
   * The SDK initialization will typically not have been completed at this point, so the plugin should take appropriate
   * actions to ensure the SDK is ready before sending track events or evaluating flags.
   *
   * @param client The SDK client instance.
   * @param environmentMetadata Information about the environment where the plugin is running.
   */
  register(client: TClient, environmentMetadata: LDPluginEnvironmentMetadata): void;

  /**
   * Gets a list of hooks that the plugin wants to register.
   *
   * This method will be called once during SDK initialization before the register method is called.
   *
   * If the plugin does not need to register any hooks, this method doesn't need to be implemented.
   * @param metadata
   */
  getHooks?(metadata: LDPluginEnvironmentMetadata): THook[];
}
