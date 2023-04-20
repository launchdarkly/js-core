import type { Info, PlatformData, SdkData } from '@launchdarkly/js-server-sdk-common-edge';

import { name, version } from '../package.json';

class CloudflarePlatformInfo implements Info {
  platformData(): PlatformData {
    return {
      name: 'Cloudflare worker',
    };
  }

  sdkData(): SdkData {
    return {
      name,
      version,
    };
  }
}

const createPlatformInfo = () => new CloudflarePlatformInfo();

export default createPlatformInfo;
