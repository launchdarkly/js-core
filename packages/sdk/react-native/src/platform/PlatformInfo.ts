import type { Info, LDLogger, PlatformData, SdkData } from '@launchdarkly/js-client-sdk-common';

import { name, version } from '../../package.json';
import { ldApplication, ldDevice } from './autoEnv';

export default class PlatformInfo implements Info {
  constructor(private readonly _logger: LDLogger) {}

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
    const data = {
      name,
      version,
      userAgentBase: 'ReactNativeClient',
    };

    this._logger.debug(`sdkData: ${JSON.stringify(data, null, 2)}`);
    return data;
  }
}
