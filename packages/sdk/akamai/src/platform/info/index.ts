import type { Info, PlatformData, SdkData } from '@launchdarkly/js-server-sdk-common';

/*
  TODO: 
    Add to release-please-config.json when ready for release
    This is needed to update the version number for sdkData
*/
class AkamaiPlatformInfo implements Info {
  platformData(): PlatformData {
    return {
      name: 'Akamai EdgeWorker',
    };
  }

  sdkData(): SdkData {
    return {
      name: '@launchdarkly/akamai-edgeworker-sdk',
      version: '0.0.1-alpha', // {x-release-please-version}
    };
  }
}

const createPlatformInfo = () => new AkamaiPlatformInfo();

export default createPlatformInfo;
