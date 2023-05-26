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

import {
  BasicLogger,
  EdgeFeatureStore,
  init as initEdge,
  LDOptions,
  LDClient,
} from '@launchdarkly/js-server-sdk-common-edge';
import AkamaiClient from './AkamaiClient';
import { EdgeProvider } from './EdgeFeatureStore';
import EdgeKVProvider from './edgeKVProvider';

export type { LDClient };

export type AkamaiClientParams = {
  sdkKey: string;
  namespace: string;
  group: string;
  featureStoreProvider: EdgeProvider;
  options: LDOptions;
};

// eslint-disable-next-line import/prefer-default-export
export const init = ({
  namespace,
  group,
  options,
  featureStoreProvider,
  sdkKey,
}: AkamaiClientParams) => {
  const logger = options.logger ?? BasicLogger.get();

  const edgekvProvider = featureStoreProvider ?? new EdgeKVProvider({ namespace, group });
  return new AkamaiClient(sdkKey, {
    featureStore: new EdgeFeatureStore(edgekvProvider, sdkKey, 'Akamai', logger),
    logger,
    ...options,
  });
};

export default init;
