import type { Info, PlatformData, SdkData } from '@launchdarkly/js-server-sdk-common';

import { name, version } from '../../package.json';

export default class CloudflareInfo implements Info {
  // eslint-disable-next-line class-methods-use-this
  platformData(): PlatformData {
    return {
      name: 'Cloudflare worker',
    };
  }

  // eslint-disable-next-line class-methods-use-this
  sdkData(): SdkData {
    return {
      name,
      version,
    };
  }
}
