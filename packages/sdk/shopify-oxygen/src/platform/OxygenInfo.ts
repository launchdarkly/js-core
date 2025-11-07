import type { Info, PlatformData, SdkData } from '@launchdarkly/js-server-sdk-common';

// TODO: maybe not the right name for this package? Currently copied from Akamai... I think
const name = '@launchdarkly/shopify-oxygen-server-sdk';
const version = '0.1.0'; // x-release-please-version

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
