import type { LDContext, LDEvaluationDetail, LDFlagValue } from '@launchdarkly/js-sdk-common';

/**
 * The minimal LDClient contract required by the OpenFeature provider.
 * Any LaunchDarkly server-side LDClient should satisfy this interface.
 */
export interface OpenFeatureLDClientContract {
  variationDetail(
    key: string,
    context: LDContext,
    defaultValue: LDFlagValue,
  ): Promise<LDEvaluationDetail>;

  waitForInitialization(options?: { timeout: number }): Promise<unknown>;

  flush(): Promise<void>;

  close(): void;

  track(key: string, context: LDContext, data?: any, metricValue?: number): void;
}
