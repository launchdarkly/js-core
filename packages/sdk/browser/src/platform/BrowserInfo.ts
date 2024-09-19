import { Info, PlatformData, SdkData } from '@launchdarkly/js-client-sdk-common';

export default class BrowserInfo implements Info {
  platformData(): PlatformData {
    return {
      name: 'JS', // Name maintained from previous 3.x implementation.
    };
  }
  sdkData(): SdkData {
    return {
      name: '@launchdarkly/js-client-sdk',
      version: '0.0.0', // x-release-please-version
      userAgentBase: 'JSClient',
    };
  }
}
