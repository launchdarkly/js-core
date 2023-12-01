import {
  base64UrlEncode,
  BasicLogger,
  LDClientImpl,
  type LDContext,
  type LDOptions,
} from '@launchdarkly/js-client-sdk-common';

import platform from './platform';

export default class ReactNativeLDClient extends LDClientImpl {
  constructor(sdkKey: string, options: LDOptions = {}) {
    const logger =
      options.logger ??
      new BasicLogger({
        level: 'info',
        // eslint-disable-next-line no-console
        destination: console.log,
      });
    super(sdkKey, platform, { ...options, logger });
  }

  override createStreamUriPath(context: LDContext) {
    return `/meval/${base64UrlEncode(JSON.stringify(context), platform.encoding!)}`;
  }
}
