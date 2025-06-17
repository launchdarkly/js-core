import { Info, PlatformData, SdkData } from '@launchdarkly/js-server-sdk-common';

const name = '@launchdarkly/fastly-server-sdk';
const version = '0.1.8'; // x-release-please-version

class FastlyPlatformInfo implements Info {
  platformData(): PlatformData {
    return {
      name: 'Fastly Compute',
    };
  }

  sdkData(): SdkData {
    return {
      name,
      version,
      userAgentBase: 'FastlyEdgeSDK',
    };
  }
}

const createPlatformInfo = () => new FastlyPlatformInfo();

export default createPlatformInfo;
