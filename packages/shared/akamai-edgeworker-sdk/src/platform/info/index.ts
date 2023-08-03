import type { Info, PlatformData, SdkData } from '@launchdarkly/js-server-sdk-common';

class AkamaiPlatformInfo implements Info {
  constructor(
    private platformName: string,
    private sdkName: string,
    private sdkVersion: string,
  ) {}

  platformData(): PlatformData {
    return {
      name: this.platformName,
    };
  }

  sdkData(): SdkData {
    return {
      name: this.sdkName,
      version: this.sdkVersion,
      userAgent: 'Akamai',
    };
  }
}

const createPlatformInfo = (platformName: string, sdkName: string, sdkVersion: string) =>
  new AkamaiPlatformInfo(platformName, sdkName, sdkVersion);

export default createPlatformInfo;
