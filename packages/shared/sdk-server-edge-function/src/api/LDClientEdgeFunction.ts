import { EventEmitter } from 'node:events';
import {
  Info,
  LDClient as LDClientCommon,
  LDClientImpl,
  LDContext,
  LDEvaluationDetail,
  LDFeatureStore,
  LDFlagsState,
  LDFlagsStateOptions,
  LDFlagValue,
} from '@launchdarkly/js-server-sdk-common';
import createOptions from './createOptions';
import createCallbacks from './createCallbacks';
import EdgeFunctionPlatform from '../platform';

/**
 * The EdgeFunction LaunchDarkly SDK client object.
 *
 * Create this object with {@link init}. Applications should configure the client at startup time
 * and continue to use it throughout the lifetime of the application, rather than creating instances
 * on the fly.
 *
 * The EdgeFunction client only supports these functions:
 *  - allFlagsState
 *  - variation
 *  - variationDetail
 *  - waitForInitialization
 */
export class LDClientEdgeFunction
  implements Pick<LDClientCommon, 'allFlagsState' | 'variation' | 'variationDetail'>
{
  emitter: EventEmitter = new EventEmitter();

  private ldClientCommon;

  // sdkKey is only used to query featureStore, not to initialize with LD servers
  constructor(sdkKey: string, featureStore: LDFeatureStore, platformInfo: Info) {
    const platform = new EdgeFunctionPlatform(platformInfo);

    this.ldClientCommon = new LDClientImpl(
      'n/a',
      platform,
      createOptions(sdkKey, featureStore),
      createCallbacks(this.emitter)
    );
  }

  allFlagsState(
    context: LDContext,
    o?: LDFlagsStateOptions,
    callback?: (err: Error | null, res: LDFlagsState | null) => void
  ): Promise<LDFlagsState> {
    return this.ldClientCommon.allFlagsState(context, o, callback);
  }

  variation(
    key: string,
    context: LDContext,
    defaultValue: LDFlagValue,
    callback?: (err: any, res: LDFlagValue) => void
  ): Promise<LDFlagValue> {
    return this.ldClientCommon.variation(key, context, defaultValue, callback);
  }

  variationDetail(
    key: string,
    context: LDContext,
    defaultValue: LDFlagValue,
    callback?: (err: any, res: LDEvaluationDetail) => void
  ): Promise<LDEvaluationDetail> {
    return this.ldClientCommon.variationDetail(key, context, defaultValue, callback);
  }

  async waitForInitialization(): Promise<this> {
    await this.ldClientCommon.waitForInitialization();
    return this;
  }
}

export default LDClientEdgeFunction;
