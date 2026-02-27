import type { Info, PlatformData, SdkData } from '@launchdarkly/js-server-sdk-common-edge';

class VercelPlatformInfo implements Info {
  platformData(): PlatformData {
    return {
      name: 'Vercel Edge',
    };
  }

  sdkData(): SdkData {
    return {
      name: '@launchdarkly/vercel-server-sdk',
      version: '1.3.41', // x-release-please-version
      userAgentBase: 'VercelEdgeSDK',
    };
  }
}

const createPlatformInfo = () => new VercelPlatformInfo();

export default createPlatformInfo;
