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
      version: '0.2.2', // {x-release-please-version}
    };
  }
}

const createPlatformInfo = () => new VercelPlatformInfo();

export default createPlatformInfo;
