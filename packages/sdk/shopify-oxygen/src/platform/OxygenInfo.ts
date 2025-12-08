import type { Info, PlatformData, SdkData } from '@launchdarkly/js-server-sdk-common';

const name = '@launchdarkly/shopify-oxygen-sdk';
const version = '0.1.1'; // x-release-please-version

class OxygenPlatformInfo implements Info {
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
      userAgentBase: 'ShopifyOxygenSDK',
    };
  }
}

export default new OxygenPlatformInfo('Shopify Oxygen', name, version);
