/* eslint-disable class-methods-use-this */
import * as os from 'os';

import { platform } from '@launchdarkly/js-server-sdk-common';

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

export default class NodeInfo implements platform.Info {
  constructor(private readonly _config: { wrapperName?: string; wrapperVersion?: string }) {}
  platformData(): platform.PlatformData {
    return {
      os: {
        name: processPlatformName(os.platform()),
        version: os.version(),
        arch: os.arch(),
      },
      name: 'Node',
      additional: {
        nodeVersion: process.versions.node,
      },
    };
  }

  sdkData(): platform.SdkData {
    return {
      name: packageJson.name,
      version: packageJson.version,
      userAgentBase: 'NodeJSClient',
      wrapperName: this._config.wrapperName,
      wrapperVersion: this._config.wrapperVersion,
    };
  }
}
