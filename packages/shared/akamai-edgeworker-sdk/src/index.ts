import {
  BasicLogger,
  LDOptions,
  LDContext,
  LDFeatureStore,
  LDMultiKindContext,
  LDSingleKindContext,
} from '@launchdarkly/js-server-sdk-common';
import { validateOptions } from './utils';
import LDClient from './api/LDClient';
import EdgePlatform from './platform';
import createPlatformInfo from './platform/info';

export interface EdgeProvider {
  get: (rootKey: string) => Promise<string | null | undefined>;
}

export type { LDClient, LDContext, LDMultiKindContext, LDSingleKindContext, LDOptions };

type BaseSDKParams = {
  sdkKey: string;
  options?: LDOptions;
  edgeFeatureStore: LDFeatureStore;
  platformName: string;
  sdkName: string;
  sdkVersion: string;
};

export const init = (params: BaseSDKParams): LDClient => {
  const { sdkKey, options = {}, edgeFeatureStore, platformName, sdkName, sdkVersion } = params;

  const logger = options.logger ?? BasicLogger.get();
  const ldOptions = {
    featureStore: edgeFeatureStore,
    logger,
    ...options,
  };

  // this throws if options are invalid
  validateOptions(params.sdkKey, ldOptions);
  const platform = createPlatformInfo(platformName, sdkName, sdkVersion);

  return new LDClient(sdkKey, new EdgePlatform(platform), ldOptions);
};
