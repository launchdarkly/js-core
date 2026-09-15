import * as os from 'os';

import { Info, PlatformData, SdkData } from '@launchdarkly/js-client-sdk-common';

const sdkName = '@launchdarkly/electron-client-sdk';
const sdkVersion = '0.0.0'; // x-release-please-version

function processPlatformName(name: string): string {
  switch (name) {
    case 'darwin':
      return 'MacOS';
    case 'win32':
      return 'Windows';
    case 'linux':
      return 'Linux';
    default:
      return name;
  }
}

export default class ElectronInfo implements Info {
  constructor(private readonly _config: { wrapperName?: string; wrapperVersion?: string } = {}) {}

  platformData(): PlatformData {
    return {
      os: {
        name: processPlatformName(os.platform()),
        version: os.release(),
        arch: os.arch(),
      },
      name: 'Electron',
      additional: {
        electronVersion: process.versions.electron,
        nodeVersion: process.versions.node,
      },
    };
  }

  sdkData(): SdkData {
    const data: SdkData = {
      name: sdkName,
      version: sdkVersion,
      userAgentBase: 'ElectronClient',
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
