/**
 * This is the API reference for the Akamai LaunchDarkly SDK.
 *
 * In typical usage, you will call {@link init} once at startup time to obtain an instance of
 * {@link LDClient}, which provides access to all of the SDK's functionality.
 *
 * For more information, see the SDK reference guide.
 *
 * @packageDocumentation
 */

import { BasicLogger, LDOptions } from '@launchdarkly/js-server-sdk-common';
import LDClient from './api/LDClient';
import { EdgeFeatureStore, EdgeProvider } from './api/edgeFeatureStore';
import EdgeKVProvider from './edgeKVProvider';
import { validateOptions } from './utils';
import EdgePlatform from './platform';
import createPlatformInfo from './platform/info';

export type { LDClient };

export type AkamaiClientParams = {
  sdkKey: string;
  namespace: string;
  group: string;
  featureStoreProvider?: EdgeProvider;
  options?: LDOptions;
};

// eslint-disable-next-line import/prefer-default-export
export const init = ({
  namespace,
  group,
  options = {},
  featureStoreProvider,
  sdkKey,
}: AkamaiClientParams): LDClient => {
  const logger = options.logger ?? BasicLogger.get();
  const edgekvProvider = featureStoreProvider ?? new EdgeKVProvider({ namespace, group });

  const ldOptions = {
    featureStore: new EdgeFeatureStore(edgekvProvider, sdkKey, 'Akamai', logger),
    logger,
    ...options,
  };

  // this throws if options are invalid
  validateOptions(sdkKey, ldOptions);

  return new LDClient(sdkKey, new EdgePlatform(createPlatformInfo()), ldOptions);
};

export default init;

