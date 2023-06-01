import { initWithEdgeKV, LDContext, LDMultiKindContext } from '@launchdarkly/akamai-edgeworker-sdk';

export type { LDContext, LDMultiKindContext };

export const evaluateFlagWithEdgeKV = async (
  flagKey: string,
  context: LDContext,
  defaultValue: boolean
) => {
  const client = initWithEdgeKV({
    sdkKey: 'your-launchdarkly-client-id',
    namespace: 'your-edgekv-namespace',
    group: 'your-edgekv-group-id',
  });
  return client.variation(flagKey, context, defaultValue);
};
