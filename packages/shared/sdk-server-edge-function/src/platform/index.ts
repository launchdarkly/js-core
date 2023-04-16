import type { Crypto, Info, Platform, Requests } from '@launchdarkly/js-server-sdk-common';
import EdgeFunctionCrypto from './crypto';
import EdgeFunctionRequests from './requests';

export default class EdgeFunctionPlatform implements Platform {
  info: Info;

  crypto: Crypto = new EdgeFunctionCrypto();

  requests: Requests = new EdgeFunctionRequests();

  constructor(info: Info) {
    this.info = info;
  }
}
