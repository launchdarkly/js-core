import type { Info, PlatformData, SdkData } from '@launchdarkly/js-server-sdk-common-edge';

class AkamaiPlatformInfo implements Info {
  platformData(): PlatformData {
    return {
      name: 'Akamai Edge',
    };
  }

  sdkData(): SdkData {
    return {
      name: '@launchdarkly/akamai-server-sdk',
      version: '0.0.1', // {x-release-please-version}
    };
  }
}

const createPlatformInfo = () => new AkamaiPlatformInfo();

export default createPlatformInfo;
