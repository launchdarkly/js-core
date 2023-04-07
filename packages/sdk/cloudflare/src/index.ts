import { KVNamespace } from '@cloudflare/workers-types';
import {
  LDClient,
  LDFlagsState,
  LDFlagsStateOptions,
  LDOptions,
  LDContext,
  LDEvaluationDetail,
  LDFlagValue,
} from '@launchdarkly/js-server-sdk-common';
import createLDClient from './createLDClient';

type LDClientSubset = Pick<
  LDClient,
  'variation' | 'variationDetail' | 'allFlagsState' | 'waitForInitialization'
>;

const init = (
  kvNamespace: KVNamespace,
  sdkKey: string,
  options: LDOptions = {}
): LDClientSubset => {
  const client = createLDClient(kvNamespace, sdkKey, options);
  return {
    variation(
      key: string,
      context: LDContext,
      defaultValue: LDFlagValue,
      callback?: (err: any, res: LDFlagValue) => void
    ): Promise<LDFlagValue> {
      return client.variation(key, context, defaultValue, callback);
    },
    variationDetail(
      key: string,
      context: LDContext,
      defaultValue: LDFlagValue,
      callback?: (err: any, res: LDEvaluationDetail) => void
    ): Promise<LDEvaluationDetail> {
      return client.variationDetail(key, context, defaultValue, callback);
    },
    allFlagsState(
      context: LDContext,
      o?: LDFlagsStateOptions,
      callback?: (err: Error | null, res: LDFlagsState | null) => void
    ): Promise<LDFlagsState> {
      return client.allFlagsState(context, o, callback);
    },
    waitForInitialization(): Promise<LDClient> {
      return client.waitForInitialization();
    },
  };
};

export default init;
