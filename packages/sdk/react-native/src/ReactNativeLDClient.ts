import {
  base64UrlEncode,
  BasicLogger,
  LDClientImpl,
  type LDContext,
  type LDOptions,
} from '@launchdarkly/js-client-sdk-common';

import createPlatform from './platform';

export default class ReactNativeLDClient extends LDClientImpl {
  constructor(sdkKey: string, options: LDOptions = {}) {
    const logger =
      options.logger ??
      new BasicLogger({
        level: 'info',
        // eslint-disable-next-line no-console
        destination: console.log,
      });

    super(sdkKey, createPlatform(logger), { ...options, logger });
  }

  override createStreamUriPath(context: LDContext) {
    return `/meval/${base64UrlEncode(JSON.stringify(context), this.platform.encoding!)}`;
  }
}
