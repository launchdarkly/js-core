import { LDIdentifyOptions } from '@launchdarkly/js-client-sdk-common';

export interface BrowserIdentifyOptions extends Omit<LDIdentifyOptions, 'waitForNetworkresults'> {
  /**
   * The signed context key if you are using [Secure Mode]
   * (https://docs.launchdarkly.com/sdk/features/secure-mode#configuring-secure-mode-in-the-javascript-client-side-sdk).
   */
  hash?: string;
}
