import type { Info, PlatformData, SdkData } from '@launchdarkly/js-server-sdk-common-edge';

const packageJson = require('../package.json');

class VercelPlatformInfo implements Info {
  platformData(): PlatformData {
    return {
      name: 'Vercel Edge',
    };
  }

  sdkData(): SdkData {
    return {
      name: packageJson.name,
      version: packageJson.version,
    };
  }
}

const createPlatformInfo = () => new VercelPlatformInfo();

export default createPlatformInfo;
