import type { Info, PlatformData, SdkData } from '@launchdarkly/js-server-sdk-common';

// import packageJson from '../../package.json';

export default class CloudflareInfo implements Info {
  platformData(): PlatformData {
    return {
      name: 'Cloudflare worker',
    };
  }

  sdkData(): SdkData {
    return {
      name: 'packageJson.name',
      version: 'packageJson.version',
    };
  }
}
