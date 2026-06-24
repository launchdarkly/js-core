import type { LDOptions, LDStartOptions } from '@launchdarkly/js-client-sdk';
import type { InjectionKey } from 'vue';

import type { LDVueInstance } from './LDClient';

/**
 * Options for the underlying LaunchDarkly client.
 */
export type LDVueClientOptions = LDOptions;

/**
 * Options for creating a Vue provider.
 */
export interface LDVueProviderOptions {
  /**
   * Options for the LaunchDarkly client.
   *
   * @see {@link LDVueClientOptions}
   */
  ldOptions?: LDVueClientOptions;

  /**
   * Options for starting the LaunchDarkly client. Useful when not deferring initialization.
   *
   * @see {@link LDStartOptions}
   */
  startOptions?: LDStartOptions;

  /**
   * If true, the client will not start automatically. Start it manually via `useLDClient().start()`.
   *
   * @defaultValue false
   */
  deferInitialization?: boolean;

  /**
   * A custom injection key, for running multiple LaunchDarkly clients in the same application. If not
   * provided, the default key is used. Create one with {@link createLDVueInstanceKey}.
   */
  injectionKey?: InjectionKey<LDVueInstance>;

  /**
   * Bootstrap data from the server. When provided, the client immediately uses these values before
   * the first network response, eliminating the flag-fetch waterfall on page load. Merged into
   * `startOptions.bootstrap`; this top-level value takes precedence.
   */
  bootstrap?: unknown;
}
