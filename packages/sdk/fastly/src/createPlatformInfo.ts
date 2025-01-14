import { Info, PlatformData, SdkData } from '@launchdarkly/js-server-sdk-common';

class VercelPlatformInfo implements Info {
  platformData(): PlatformData {
    return {
      name: 'Fastly Edge',
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

const createPlatformInfo = () => new VercelPlatformInfo();

export default createPlatformInfo;
