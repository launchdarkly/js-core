import type { Info, PlatformData, SdkData } from '@launchdarkly/js-server-sdk-common-edge';

const name = '@launchdarkly/cloudflare-server-sdk';
const version = '2.7.16'; // x-release-please-version

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

const createPlatformInfo = (): CloudflarePlatformInfo => new CloudflarePlatformInfo();

export default createPlatformInfo;
