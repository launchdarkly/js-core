import { Info, PlatformData, SdkData } from '@launchdarkly/js-server-sdk-common';

class FastlyPlatformInfo implements Info {
  platformData(): PlatformData {
    return {
      name: 'Fastly Compute',
    };
  }

  sdkData(): SdkData {
    return {
      name: '@launchdarkly/fastly-server-sdk',
      version: '__LD_VERSION__',
      userAgentBase: 'FastlyEdgeSDK',
    };
  }
}

const createPlatformInfo = () => new FastlyPlatformInfo();

export default createPlatformInfo;
