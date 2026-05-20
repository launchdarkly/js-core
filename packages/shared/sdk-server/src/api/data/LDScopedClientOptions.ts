/**
 * Options for creating a scoped client via {@link LDClient.forContext}.
 *
 * @remarks
 * These options enable higher-level SDK wrappers built on top of scoped clients
 * to identify themselves for wrapper reporting. If no options are provided,
 * the scoped client behaves as a plain scoped client with no wrapper reporting.
 */
export interface LDScopedClientOptions {
  /**
   * The name of the wrapper SDK built on top of the scoped client.
   *
   * @remarks
   * When provided, the SDK will emit a `diagnostic-init` event upon scoped client
   * creation with wrapper identification. This enables LaunchDarkly to measure
   * wrapper SDK adoption.
   */
  wrapperName?: string;

  /**
   * The version of the wrapper SDK.
   *
   * @remarks
   * Ignored if {@link wrapperName} is not set.
   */
  wrapperVersion?: string;
}
