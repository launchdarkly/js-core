import { LDIdentifyOptions } from '@launchdarkly/js-client-sdk-common';

/**
 * @property sheddable - If true, the identify operation will be sheddable. This means that if multiple identify operations are done, without
 * waiting for the previous one to complete, then intermediate results will be discarded. When false, identify
 * operations will be queued and completed sequentially.
 *
 * Defaults to true.
 */
export interface BrowserIdentifyOptions extends Omit<LDIdentifyOptions, 'waitForNetworkResults'> {
  /**
   * The signed context key if you are using [Secure Mode]
   * (https://docs.launchdarkly.com/sdk/features/secure-mode#configuring-secure-mode-in-the-javascript-client-side-sdk).
   */
  hash?: string;
}
