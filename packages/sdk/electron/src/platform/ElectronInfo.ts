import * as os from 'os';

import { Info, PlatformData, SdkData } from '@launchdarkly/js-client-sdk-common';

import * as packageJson from '../../package.json';

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
    return {
      name: packageJson.name,
      version: packageJson.version,
      userAgentBase: 'ElectronClient',
    };
  }
}
