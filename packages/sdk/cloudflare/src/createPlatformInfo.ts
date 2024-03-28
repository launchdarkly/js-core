import type { Info, PlatformData, SdkData } from '@launchdarkly/js-server-sdk-common-edge';

// eslint-disable-next-line prettier/prettier
import packageJson from '../package.json' assert { type: "json" }

const { name, version } = packageJson

class CloudflarePlatformInfo implements Info {
  platformData(): PlatformData {
    return {
      name: 'Cloudflare',
    };
  }

  sdkData(): SdkData {
    return {
      name,
      version,
      userAgentBase: 'CloudflareEdgeSDK',
    };
  }
}

const createPlatformInfo = (): CloudflarePlatformInfo => new CloudflarePlatformInfo()

export default createPlatformInfo;
