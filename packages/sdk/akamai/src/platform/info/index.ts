import type { Info, PlatformData, SdkData } from '@launchdarkly/js-server-sdk-common';

class AkamaiPlatformInfo implements Info {
  platformData(): PlatformData {
    return {
      name: 'Akamai EdgeWorker',
    };
  }

  sdkData(): SdkData {
    return {
      name: '@launchdarkly/akamai-edgeworker-sdk',
      version: '0.1.0-alpha', // {x-release-please-version}
    };
  }
}

const createPlatformInfo = () => new AkamaiPlatformInfo();

export default createPlatformInfo;
