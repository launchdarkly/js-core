/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable class-methods-use-this */
import { LDProxyOptions, LDTLSOptions, platform } from '@launchdarkly/js-server-sdk-common';
// @ts-ignore
// import { EventSource as LDEventSource } from 'js-eventsource';

export default class FastlyRequests implements platform.Requests {
  private agent:undefined;

  private tlsOptions: LDTLSOptions | undefined;

  private hasProxy: boolean = false;

  private hasProxyAuth: boolean = false;

  constructor(tlsOptions?: LDTLSOptions, proxyOptions?: LDProxyOptions) {
    this.hasProxy = !!proxyOptions;
    this.hasProxyAuth = !!proxyOptions?.auth;
  }

  // eslint-disable-next-line class-methods-use-this
  fetch(url: string, options: platform.Options = {}): Promise<platform.Response> {
    // @ts-ignore
    return fetch(options.tlsParams, {
      // @ts-ignore
      backend: 'ldstream',
    });
  }

  // @ts-ignore
}
