/* eslint-disable class-methods-use-this */
import { platform } from '@launchdarkly/js-server-sdk-common';
import { PlatformData, SdkData } from '@launchdarkly/js-server-sdk-common/dist/platform/Info';

import * as os from 'os';

import packageJson from '../package.json';

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

export default class NodeInfo implements platform.Info {
  platformData(): PlatformData {
    return {
      os: {
        name: processPlatformName(os.platform()),
        version: os.version(),
      },
      name: 'Node',
      version: process.version,
    };
  }

  sdkData(): SdkData {
    return {
      name: packageJson.name,
      version: packageJson.version,
      // No wrapper name/version at the moment.
    };
  }
}
