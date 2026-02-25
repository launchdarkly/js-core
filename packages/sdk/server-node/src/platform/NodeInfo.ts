/* eslint-disable class-methods-use-this */
import * as os from 'os';

import { platform } from '@launchdarkly/js-server-sdk-common';

const sdkName = '@launchdarkly/node-server-sdk';
const sdkVersion = '9.10.7'; // x-release-please-version

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
      name: sdkName,
      version: sdkVersion,
      userAgentBase: 'NodeJSClient',
      wrapperName: this._config.wrapperName,
      wrapperVersion: this._config.wrapperVersion,
    };
  }
}
