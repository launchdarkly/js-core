/* eslint-disable */
import { KVNamespace } from '@cloudflare/workers-types';
import { LDOptions } from '@launchdarkly/js-server-sdk-common';
import createConfig from './configuration';

const ldClient = (kvNamespace: KVNamespace, sdkKey: string, options: LDOptions) => {
  const config = createConfig(kvNamespace, sdkKey, options);
  // const ldClient = ld.init('none', config);
  // const client = {};
  //
  // client.variation = function (key, user, defaultValue, callback) {
  //   return ldClient.variation(key, user, defaultValue, callback);
  // };
  //
  // client.variationDetail = function (key, user, defaultValue, callback) {
  //   return ldClient.variationDetail(key, user, defaultValue, callback);
  // };
  //
  // client.allFlagsState = function (user, options, callback) {
  //   return ldClient.allFlagsState(user, options, callback);
  // };
  //
  // client.waitForInitialization = function () {
  //   return ldClient.waitForInitialization();
  // };
  //
  // return client;
  const testOutput = `kv=${kvNamespace}; sdkKey=${sdkKey};`;
  console.log(`============== ${testOutput}`);
  return testOutput;
};

export default ldClient;
