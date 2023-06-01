import { EdgeProvider, initWithFeatureStore, LDContext } from '@launchdarkly/akamai-edgeworker-sdk';

export type { LDContext, EdgeProvider };

class MyCustomStoreProvider implements EdgeProvider {
  // root key is formatted as LD-Env-{Launchdarkly environment client ID}
  async get(rootKey: string): Promise<string> {
    // you should provide an implementation to retrieve your flags from launchdarkly's https://sdk.launchdarkly.com/sdk/latest-all endpoint.
    // see https://docs.launchdarkly.com/sdk/features/flags-from-files for more information.
    return flagData;
  }
}

export const evaluateFlagFromCustomFeatureStore = async (
  flagKey: string,
  context: LDContext,
  defaultValue: boolean
) => {
  const client = initWithFeatureStore({
    sdkKey: 'Your-launchdarkly-environment-client-id',
    featureStoreProvider: new MyCustomStoreProvider(),
  });

  return await client.variation(flagKey, context, defaultValue);
};

const flagData = `
{
  "flags": {
    "enable-ads": {
      "key": "enable-ads",
      "on": true,
      "prerequisites": [],
      "targets": [],
      "contextTargets": [],
      "rules": [],
      "fallthrough": {
        "variation": 0
      },
      "offVariation": 1,
      "variations": [
        true,
        false
      ],
      "clientSideAvailability": {
        "usingMobileKey": true,
        "usingEnvironmentId": false
      },
      "clientSide": false,
      "salt": "xxxxxxxxxxxx",
      "trackEvents": false,
      "trackEventsFallthrough": false,
      "debugEventsUntilDate": null,
      "version": 5,
      "deleted": false
    }
  },
  "segments": {}
}
`;
