import type { Info, PlatformData, SdkData } from '@launchdarkly/js-server-sdk-common';

class AkamaiPlatformInfo implements Info {
  constructor(
    private _platformName: string,
    private _sdkName: string,
    private _sdkVersion: string,
  ) {}

  platformData(): PlatformData {
    return {
      name: this._platformName,
    };
  }

  sdkData(): SdkData {
    return {
      name: this._sdkName,
      version: this._sdkVersion,
      userAgentBase: 'AkamaiEdgeSDK',
    };
  }
}

const createPlatformInfo = (platformName: string, sdkName: string, sdkVersion: string) =>
  new AkamaiPlatformInfo(platformName, sdkName, sdkVersion);

export default createPlatformInfo;
