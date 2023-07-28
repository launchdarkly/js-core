// eslint-disable-next-line max-classes-per-file
import {
  LDClientImpl,
  LDClient as LDClientType,
  LDContext,
  LDEvaluationDetail,
  LDFlagsState,
  LDFlagsStateOptions,
  LDFlagValue,
  LDOptions,
} from '@launchdarkly/js-server-sdk-common';

import CacheableStoreProvider from '../featureStore/cacheableStoreProvider';
import EdgePlatform from '../platform';
import { createCallbacks, createOptions } from '../utils';

export interface CustomLDOptions extends LDOptions {}

/**
 * The LaunchDarkly Akamai SDK edge client object.
 */
class LDClient extends LDClientImpl {
  private cacheableStoreProvider!: CacheableStoreProvider;

  // sdkKey is only used to query featureStore, not to initialize with LD servers
  constructor(
    sdkKey: string,
    platform: EdgePlatform,
    options: LDOptions,
    storeProvider: CacheableStoreProvider,
  ) {
    super(sdkKey, platform, createOptions(options), createCallbacks());
    this.cacheableStoreProvider = storeProvider;
  }

  override waitForInitialization(): Promise<LDClientType> {
    // we need to resolve the promise immediately because Akamai's runtime doesnt
    // have a setimeout so everything executes synchronously.
    return Promise.resolve(this);
  }

  override async variation(
    key: string,
    context: LDContext,
    defaultValue: LDFlagValue,
    callback?: (err: any, res: LDFlagValue) => void,
  ): Promise<LDFlagValue> {
    await this.cacheableStoreProvider.prefetchPayloadFromOriginStore();
    return super.variation(key, context, defaultValue, callback);
  }

  override async variationDetail(
    key: string,
    context: LDContext,
    defaultValue: LDFlagValue,
    callback?: (err: any, res: LDEvaluationDetail) => void,
  ): Promise<LDEvaluationDetail> {
    await this.cacheableStoreProvider.prefetchPayloadFromOriginStore();
    return super.variationDetail(key, context, defaultValue, callback);
  }

  override async allFlagsState(
    context: LDContext,
    options?: LDFlagsStateOptions,
    callback?: (err: Error | null, res: LDFlagsState) => void,
  ): Promise<LDFlagsState> {
    await this.cacheableStoreProvider.prefetchPayloadFromOriginStore();
    return super.allFlagsState(context, options, callback);
  }
}

export default LDClient;
