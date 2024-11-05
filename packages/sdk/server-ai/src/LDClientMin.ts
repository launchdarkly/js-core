import { LDContext, LDFlagValue } from '@launchdarkly/js-server-sdk-common';


export interface LDClientMin {
  variation(
    key: string,
    context: LDContext,
    defaultValue: LDFlagValue,
    callback?: (err: any, res: LDFlagValue) => void
  ): Promise<LDFlagValue>;

  track(key: string, context: LDContext, data?: any, metricValue?: number): void;
}
