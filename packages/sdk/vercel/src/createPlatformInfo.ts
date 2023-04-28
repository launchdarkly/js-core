import type { Info, PlatformData, SdkData } from '@launchdarkly/js-server-sdk-common-edge';

import { name, version } from '../package.json';

class VercelPlatformInfo implements Info {
  platformData(): PlatformData {
    return {
      name: 'Vercel Edge',
    };
  }

  sdkData(): SdkData {
    return {
      name,
      version,
    };
  }
}

const createPlatformInfo = () => new VercelPlatformInfo();

export default createPlatformInfo;
