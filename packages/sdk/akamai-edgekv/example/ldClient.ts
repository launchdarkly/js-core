import { init, LDContext, LDMultiKindContext } from '@launchdarkly/akamai-server-edgekv-sdk';

export type { LDContext, LDMultiKindContext };

export const evaluateFlagWithEdgeKV = async (
  flagKey: string,
  context: LDContext,
  defaultValue: boolean,
) => {
  const client = init({
    sdkKey: 'your-launchdarkly-client-id',
    namespace: 'your-edgekv-namespace',
    group: 'your-edgekv-group-id',
  });
  return client.variation(flagKey, context, defaultValue);
};
