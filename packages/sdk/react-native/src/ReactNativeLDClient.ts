import {
  base64UrlEncode,
  LDClientImpl,
  type LDContext,
  type LDOptions,
} from '@launchdarkly/js-client-sdk-common';

import platform from './platform';

export default class ReactNativeLDClient extends LDClientImpl {
  constructor(sdkKey: string, options: LDOptions = {}) {
    super(sdkKey, platform, options);
  }

  override createStreamUriPath(context: LDContext) {
    return `/meval/${base64UrlEncode(JSON.stringify(context), platform.encoding!)}`;
  }
}
