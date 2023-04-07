import { KVNamespace } from '@cloudflare/workers-types';
import { LDOptions } from '@launchdarkly/js-server-sdk-common';
import LDClientCloudflare from './LDClientCloudflare';

const createLDClient = (kvNamespace: KVNamespace, sdkKey: string, options: LDOptions = {}) =>
  new LDClientCloudflare(kvNamespace, sdkKey, options);

export default createLDClient;
