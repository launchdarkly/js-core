import { LDOptions as LDOptionsCommon } from '@launchdarkly/js-server-sdk-common';

import { LDContextProvider } from './LDContextProvider';

export interface LDReactServerOptions extends LDOptionsCommon {
  /**
   * A provider for the Launchdarkly context.
   *
   * @remarks
   * This is left up to the developer to implement and will be used
   * to do server side flag evalations. LDClient will not initialize
   * if this is not provided.
   */
  contextProvider: LDContextProvider;
}
