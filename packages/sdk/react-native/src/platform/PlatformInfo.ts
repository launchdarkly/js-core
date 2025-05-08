import type { Info, LDLogger, PlatformData, SdkData } from '@launchdarkly/js-client-sdk-common';

import { name, version } from '../../package.json';
import { ldApplication, ldDevice } from './autoEnv';

export default class PlatformInfo implements Info {
  constructor(
    private readonly _logger: LDLogger,
    private readonly _config: { wrapperName?: string; wrapperVersion?: string },
  ) {}

  platformData(): PlatformData {
    const data = {
      name: 'React Native',
      ld_application: ldApplication,
      ld_device: ldDevice,
    };

    this._logger.debug(`platformData: ${JSON.stringify(data, null, 2)}`);
    return data;
  }

  sdkData(): SdkData {
    const data: SdkData = {
      name,
      version,
      userAgentBase: 'ReactNativeClient',
    };

    if (this._config?.wrapperName) {
      data.wrapperName = this._config.wrapperName;
    }

    if (this._config?.wrapperVersion) {
      data.wrapperVersion = this._config.wrapperVersion;
    }

    this._logger.debug(`sdkData: ${JSON.stringify(data, null, 2)}`);
    return data;
  }
}
