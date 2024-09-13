import {
  AutoEnvAttributes,
  base64UrlEncode,
  LDClient as CommonClient,
  DataSourcePaths,
  Encoding,
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
      userAgentHeaderName: 'x-launchdarkly-user-agent',
    });
  }

  private encodeContext(context: LDContext) {
    return base64UrlEncode(JSON.stringify(context), this.platform.encoding!);
  }

  override getStreamingPaths(): DataSourcePaths {
    const parentThis = this;
    return {
      pathGet(encoding: Encoding, _credential: string, _plainContextString: string): string {
        return `/eval/${parentThis.clientSideId}/${base64UrlEncode(_plainContextString, encoding)}`;
      },
      pathReport(_encoding: Encoding, _credential: string, _plainContextString: string): string {
        return `/eval/${parentThis.clientSideId}`;
      },
    };
  }

  override getPollingPaths(): DataSourcePaths {
    const parentThis = this;
    return {
      pathGet(encoding: Encoding, _credential: string, _plainContextString: string): string {
        return `/sdk/evalx/${parentThis.clientSideId}/contexts/${base64UrlEncode(_plainContextString, encoding)}`;
      },
      pathReport(_encoding: Encoding, _credential: string, _plainContextString: string): string {
        return `/sdk/evalx/${parentThis.clientSideId}/contexts`;
      },
    };
  }
}
