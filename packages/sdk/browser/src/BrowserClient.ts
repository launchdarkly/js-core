import {
  AutoEnvAttributes,
  base64UrlEncode,
  LDClient as CommonClient,
  LDClientImpl,
  LDContext,
  LDOptions,
} from '@launchdarkly/js-client-sdk-common';

import BrowserPlatform from './platform/BrowserPlatform';

/**
 * We are not supporting dynamically setting the connection mode on the LDClient.
 */
export type LDClient = Omit<CommonClient, 'setConnectionMode'>;

export class BrowserClient extends LDClientImpl {
  constructor(
    private readonly clientSideId: string,
    autoEnvAttributes: AutoEnvAttributes,
    options: LDOptions = {},
  ) {
    super(clientSideId, autoEnvAttributes, new BrowserPlatform(options), options, {
      analyticsEventPath: `/events/bulk/${clientSideId}`,
      diagnosticEventPath: `/events/diagnostic/${clientSideId}`,
      includeAuthorizationHeader: false,
      highTimeoutThreshold: 5,
    });
  }

  private encodeContext(context: LDContext) {
    return base64UrlEncode(JSON.stringify(context), this.platform.encoding!);
  }

  override createStreamUriPath(context: LDContext) {
    return `/eval/${this.clientSideId}/${this.encodeContext(context)}`;
  }

  override createPollUriPath(context: LDContext): string {
    return `/sdk/evalx/${this.clientSideId}/contexts/${this.encodeContext(context)}`;
  }
}
