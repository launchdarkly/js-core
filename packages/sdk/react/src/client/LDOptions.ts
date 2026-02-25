import { LDContext, LDOptions as LDOptionsBase, LDStartOptions } from '@launchdarkly/js-client-sdk';

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
   * @see https://docs.launchdarkly.com/sdk/client-side/react/react-web#flag-keys
   */
  useCamelCaseFlagKeys?: boolean;
}

/**
 * Options for creating a React Provider.
 */
export interface LDReactProviderOptions {
  /**
   * LaunchDarkly initialization options. These options are common between LaunchDarkly's JavaScript and React SDKs.
   *
   * @see {@link LDReactClientOptions} for the possible options
   */
  options?: LDReactClientOptions;

  /**
   * Your project and environment specific client side ID. You can find
   * this in your LaunchDarkly portal under Account settings.
   */
  clientSideID: string;

  /**
   * A LaunchDarkly context object. This will be used as the initial
   * context for the client.
   */
  context: LDContext;

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
   * If set to false, the LDClient will initialize immediately.
   *
   * @default true
   *
   * If intiailization is deferred, then the LDClient can be initialized manually
   * by calling the `start` function.
   */
  deferInitialization?: boolean;
}
