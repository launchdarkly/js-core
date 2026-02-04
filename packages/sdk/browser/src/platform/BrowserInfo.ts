import { Info, PlatformData, SdkData } from '@launchdarkly/js-client-sdk-common';

export default class BrowserInfo implements Info {
  constructor(private readonly _config: { wrapperName?: string; wrapperVersion?: string }) {}

  platformData(): PlatformData {
    return {
      name: 'JS', // Name maintained from previous 3.x implementation.
    };
  }

  sdkData(): SdkData {
    const data: SdkData = {
      name: '@launchdarkly/js-client-sdk',
      version: '4.0.0', // x-release-please-version
      userAgentBase: 'JSClient',
    };

    if (this._config.wrapperName) {
      data.wrapperName = this._config.wrapperName;
    }

    if (this._config.wrapperVersion) {
      data.wrapperVersion = this._config.wrapperVersion;
    }

    return data;
  }
}
