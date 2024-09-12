import type { Info, PlatformData, SdkData } from '@launchdarkly/js-server-sdk-common-edge';

const name = '@launchdarkly/netlify-server-sdk';
const version = '__LD_VERSION__';

class NetlifyPlatformInfo implements Info {
  platformData(): PlatformData {
    return {
      name: 'Netlify',
    };
  }

  sdkData(): SdkData {
    return {
      name,
      version,
      userAgentBase: 'NetlifyEdgeSDK',
    };
  }
}

const createPlatformInfo = (): NetlifyPlatformInfo => new NetlifyPlatformInfo();

export default createPlatformInfo;
