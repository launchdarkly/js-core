// TODO: DRY out vercel/cloudflare/shared stuff
import type { Info, PlatformData, SdkData } from '@launchdarkly/js-server-sdk-common';

// import packageJson from '../../package.json';

export default class VercelInfo implements Info {
  platformData(): PlatformData {
    return {
      name: 'Vercel worker',
    };
  }

  sdkData(): SdkData {
    return {
      name: 'packageJson.name',
      version: 'packageJson.version',
    };
  }
}
