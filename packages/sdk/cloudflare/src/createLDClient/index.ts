import { KVNamespace } from '@cloudflare/workers-types';
import { LDOptions } from '@launchdarkly/js-server-sdk-common';
import CloudflareImpl from './CloudflareImpl';

const createLDClient = (kvNamespace: KVNamespace, sdkKey: string, options: LDOptions = {}) =>
  new CloudflareImpl(kvNamespace, sdkKey, options);

export default createLDClient;
