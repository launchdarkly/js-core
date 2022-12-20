/* eslint-disable class-methods-use-this */
import { platform } from '@launchdarkly/js-server-sdk-common';

import * as packageJson from '../../package.json';

export default class NodeInfo implements platform.Info {
  platformData(): platform.PlatformData {
    return {
      name: 'Fastly',
    };
  }

  sdkData(): platform.SdkData {
    return {
      name: packageJson.name,
      version: packageJson.version,
      // No wrapper name/version at the moment.
    };
  }
}
