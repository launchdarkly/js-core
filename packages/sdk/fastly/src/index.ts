/// <reference types="@fastly/js-compute" />
import { KVStore } from 'fastly:kv-store';

import { BasicLogger, LDOptions } from '@launchdarkly/js-server-sdk-common';

import { EdgeFeatureStore, EdgeProvider, LDClient } from './api';
import createPlatformInfo from './createPlatformInfo';
import validateOptions from './utils/validateOptions';

const DEFAULT_EVENTS_BACKEND_NAME = 'launchdarkly';

export type FastlySDKOptions = LDOptions & {
  /**
   * The Fastly Backend name to send LaunchDarkly events. Backends are configured using the Fastly service backend configuration. This option can be ignored if the `sendEvents` option is set to `false`. See [Fastly's Backend documentation](https://developer.fastly.com/reference/api/services/backend/) for more information. The default value is `launchdarkly`.
   */
  eventsBackendName?: string;
};

export const init = (
  sdkKey: string,
  kvStore: KVStore,
  options: FastlySDKOptions = { eventsBackendName: DEFAULT_EVENTS_BACKEND_NAME },
) => {
  const logger = options.logger ?? BasicLogger.get();

  const edgeProvider: EdgeProvider = {
    get: async (rootKey: string) => {
      const entry = await kvStore.get(rootKey);
      return entry ? entry.text() : null;
    },
  };

  const { eventsBackendName, ...ldOptions } = options;

  const finalOptions = {
    featureStore: new EdgeFeatureStore(edgeProvider, sdkKey, 'Fastly', logger),
    logger,
    ...ldOptions,
  };

  validateOptions(sdkKey, finalOptions);
  return new LDClient(
    sdkKey,
    createPlatformInfo(),
    finalOptions,
    eventsBackendName || DEFAULT_EVENTS_BACKEND_NAME,
  );
};
