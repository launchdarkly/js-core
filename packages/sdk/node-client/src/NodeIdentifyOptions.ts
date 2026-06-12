import type { LDIdentifyOptions } from '@launchdarkly/js-client-sdk-common';

/**
 * Options for {@link LDClient.identify} on the Node.js client-side SDK.
 */
export interface NodeIdentifyOptions extends LDIdentifyOptions {
  /**
   * The signed context key for
   * [Secure Mode](https://docs.launchdarkly.com/sdk/features/secure-mode).
   *
   * When provided, overrides the `hash` value from the SDK configuration for
   * this identify call and all subsequent network requests until the next
   * `identify`. When omitted, the SDK uses the `hash` from `LDOptions` (if
   * configured).
   */
  hash?: string;
}
