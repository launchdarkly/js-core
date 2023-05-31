import { initWithEdgeKV, LDContext, LDMultiKindContext } from '@launchdarkly/akamai-edgeworker-sdk';

export type { LDContext, LDMultiKindContext };

export const evaluateFlagWithEdgeKV = async (
  flagKey: string,
  context: LDContext,
  defaultValue: boolean
) => {
  const client = initWithEdgeKV({
    sdkKey: '61d8ad949ae37514e4930155',
    namespace: 'cliff-ns-staging',
    group: '0',
  });
  return await client.variation(flagKey, context, defaultValue);
};
