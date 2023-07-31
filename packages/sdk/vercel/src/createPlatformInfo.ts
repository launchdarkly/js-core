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
      version: '__LD_VERSION__',
      wrapperName: 'VercelEdgeSDK',
      wrapperVersion: '__LD_VERSION__',
    };
  }
}

const createPlatformInfo = () => new VercelPlatformInfo();

export default createPlatformInfo;
