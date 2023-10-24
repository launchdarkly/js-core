import { LDClientImpl, LDOptions } from '@launchdarkly/js-client-sdk-common';

import platform from './platform';

export default class ReactNativeLDClient extends LDClientImpl {
  constructor(sdkKey: string, options: LDOptions = {}) {
    super(sdkKey, platform, options);
  }
}
