/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable class-methods-use-this */
import {
  EventSourceInitDict, LDProxyOptions, LDTLSOptions, platform,
} from '@launchdarkly/js-server-sdk-common';
import FastlyEventSource from './FastlyEventSource';
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

  fetch(url: string, options: platform.Options = {}): Promise<platform.Response> {
    // @ts-ignore
    return fetch(url, options, {
      backend: 'ldstream',
    });
  }

  createEventSource(url: string, eventSourceInitDict: EventSourceInitDict): platform.EventSource {
    return new FastlyEventSource(url, eventSourceInitDict);
  }
}
