import { LDContext, LDEvaluationDetail, LDFlagValue } from '@launchdarkly/cloudflare-server-sdk';

/**
 * Interface which represents the required interface components for the Cloudflare server SDK
 * to work with the AI SDK.
 */
export interface LDClientMin {
  variation(
    key: string,
    context: LDContext,
    defaultValue: LDFlagValue,
    callback?: (err: any, res: LDFlagValue) => void,
  ): Promise<LDFlagValue>;

  variationDetail(
    key: string,
    context: LDContext,
    defaultValue: LDFlagValue,
    callback?: (err: any, res: LDEvaluationDetail) => void,
  ): Promise<LDEvaluationDetail>;

  track(key: string, context: LDContext, data?: any, metricValue?: number): void;
}
