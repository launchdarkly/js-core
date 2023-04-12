// TODO: DRY out vercel/cloudflare/shared stuff
import type { Crypto, Info, Platform, Requests } from '@launchdarkly/js-server-sdk-common';
import VercelCrypto from './crypto';
import VercelInfo from './info';
import VercelRequests from './requests';

export default class VercelPlatform implements Platform {
  info: Info = new VercelInfo();

  crypto: Crypto = new VercelCrypto();

  requests: Requests = new VercelRequests();
}
