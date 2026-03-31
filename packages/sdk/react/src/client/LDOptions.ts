import { LDOptions as LDOptionsBase, LDStartOptions } from '@launchdarkly/js-client-sdk';

import { LDReactClientContext } from './LDClient';

/**
 * Initialization options for the LaunchDarkly React SDK.
 */
export interface LDReactClientOptions extends LDOptionsBase {
  /**
   * Whether the React SDK should transform flag keys into camel-cased format.
   * Using camel-cased flag keys allow for easier use as prop values, however,
   * these keys won't directly match the flag keys as known to LaunchDarkly.
   * Consequently, flag key collisions may be possible and the Code References feature
   * will not function properly.
   *
   * This is true by default, meaning that keys will automatically be converted to camel-case.
   *
   * For more information, see the React SDK Reference Guide on
   * [flag keys](https://docs.launchdarkly.com/sdk/client-side/react/react-web#flag-keys).
   *
   * @deprecated This option is deprecated and will be removed in a future major version.
   *
   * @see https://docs.launchdarkly.com/sdk/client-side/react/react-web#flag-keys
   */
  useCamelCaseFlagKeys?: boolean;
}

/**
 * Options for creating a React Provider.
 */
export interface LDReactProviderOptions {
  /**
   * Options for the LaunchDarkly client.
   *
   * @remarks
   * This option is used to pass options to the LaunchDarkly client.
   *
   * @see {@link LDReactClientOptions} for the possible options
   */
  ldOptions?: LDReactClientOptions;

  /**
   * Options for starting the LaunchDarkly client.
   *
   * @remarks
   * This option is especially useful if you choose to not defer
   * initialization and want to start the client immediately.
   *
   * @see {@link LDStartOptions} for the possible options
   */
  startOptions?: LDStartOptions;

  /**
   * If set to true, the LDClient will not start automatically.
   *
   * @default false
   *
   * If initialization is deferred, then the LDClient can be started manually
   * by calling the `start` function.
   */
  deferInitialization?: boolean;

  /**
   * This option allows developers to provide their own named react context for
   * the LaunchDarkly client. This is useful for cases where you want to have multiple
   * clients in the same application. If not provided, the default context will be used.
   *
   * @see {@link LDReactClientContext}
   */
  reactContext?: LDReactClientContext;

  /**
   * Bootstrap data from the server. Pass the result of `flagsState.toJSON()` obtained
   * from the server SDK's `allFlagsState` method.
   *
   * When provided, the client immediately uses these values before the first network
   * response arrives — eliminating the flag-fetch waterfall on page load.
   *
   * This is merged into `startOptions.bootstrap` when the client is started. If both
   * `bootstrap` and `startOptions.bootstrap` are provided, this top-level value takes
   * precedence.
   */
  bootstrap?: unknown;
}
