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
import type { EdgeProvider } from './featureStore';
import { EdgeFeatureStore } from './featureStore';
import { LDOptions as LDOptionsCommon } from '@launchdarkly/js-server-sdk-common';

/**
 * The Launchdarkly Edge SDKs configuration options. Only logger is officially
 * supported. sendEvents is unsupported and is only included as a beta
 * preview.
 */
type LDOptions = Pick<LDOptionsCommon, 'logger' | 'sendEvents'>;

/**
 * The internal options include featureStore because that's how the LDClient
 * implementation expects it.
 */
type LDOptionsInternal = LDOptions & Pick<LDOptionsCommon, 'featureStore'>;

export * from '@launchdarkly/js-server-sdk-common';
export { EdgeFeatureStore, EdgeProvider, LDOptions, LDOptionsInternal };

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
