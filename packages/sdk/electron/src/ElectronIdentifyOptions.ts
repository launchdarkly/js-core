import type { LDIdentifyOptions } from '@launchdarkly/js-client-sdk-common';

/**
 * Options for {@link LDClient.identify} on the Electron SDK.
 */
export interface ElectronIdentifyOptions extends LDIdentifyOptions {
  /**
   * The secure mode hash for the context passed to this identify call.
   *
   * When set, this value replaces the `hash` from the SDK options for this identify call and all
   * later network requests until the next identify. When omitted, the SDK uses the `hash` from
   * the SDK options, if any. Secure mode works only when `useClientSideId` is `true`. A hash
   * passed here with a mobile key is ignored with a warning. Unlike the `hash` option, it does not
   * throw, because a throw during a running identify would disrupt the application.
   *
   * @see https://docs.launchdarkly.com/sdk/features/secure-mode
   */
  hash?: string;
}
