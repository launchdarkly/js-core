import { LDContext, LDFlagValue } from '@launchdarkly/js-server-sdk-common';

/**
 * Interface which represents the required interface components for a sever SDK
 * to work with the AI SDK.
 */
export interface LDClientMin {
  variation(
    key: string,
    context: LDContext,
    defaultValue: LDFlagValue,
    callback?: (err: any, res: LDFlagValue) => void,
  ): Promise<LDFlagValue>;

  track(key: string, context: LDContext, data?: any, metricValue?: number): void;
}
