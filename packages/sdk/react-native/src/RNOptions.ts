import { LDOptions, Storage } from '@launchdarkly/js-client-sdk-common';

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
   * Custom persistence layer for offline mode.
   *
   * Defaults to AsyncStorage.
   */
  readonly storage?: Storage;
}

export default interface RNOptions extends LDOptions, RNSpecificOptions {}
