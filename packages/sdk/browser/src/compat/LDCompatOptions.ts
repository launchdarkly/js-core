import { LDFlagSet } from '@launchdarkly/js-client-sdk-common';

import { BrowserOptions } from '../options';

export interface LDOptions extends BrowserOptions {
  /**
   * The initial set of flags to use until the remote set is retrieved.
   *
   * For more information, refer to the
   * [SDK Reference Guide](https://docs.launchdarkly.com/sdk/features/bootstrapping#javascript).
   */
  bootstrap?: LDFlagSet;

  /**
   * The signed canonical context key, for the initial context, if you are using
   * [Secure Mode](https://docs.launchdarkly.com/sdk/features/secure-mode#configuring-secure-mode-in-the-javascript-client-side-sdk).
   */
  hash?: string;
}
