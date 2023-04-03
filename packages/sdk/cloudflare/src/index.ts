import { KVNamespace } from '@cloudflare/workers-types';
import { LDClient, LDOptions } from '@launchdarkly/js-server-sdk-common';
import createConfig from './configuration';
import LDClientCloudflare from './LDClientCloudflare';

export default (kvNamespace: KVNamespace, sdkKey: string, options: LDOptions) => {
  const config = createConfig(kvNamespace, sdkKey, options);
  const client = new LDClientCloudflare('none', config);
  const partialClient: Partial<LDClient> = {};

  partialClient.variation = (key, user, defaultValue, callback) =>
    client.variation(key, user, defaultValue, callback);

  partialClient.variationDetail = (key, user, defaultValue, callback) =>
    client.variationDetail(key, user, defaultValue, callback);

  partialClient.allFlagsState = (user, o, callback) => client.allFlagsState(user, o, callback);

  partialClient.waitForInitialization = () => client.waitForInitialization();

  return partialClient;
};
