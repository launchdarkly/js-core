import { init } from '@launchdarkly/shopify-oxygen-sdk';

// Set sdkKey to your LaunchDarkly SDK key.
const sdkKey = 'sample-sdk-key';

// Set featureFlagKey to the feature flag key you want to evaluate.
const flagKey = 'sample-feature';

const context = {
  kind: 'user',
  key: 'example-user-key',
  name: 'Sandy'
};

const sdkOptions = {
  // See the README.md file for more information on the options.
};

export default {
  async fetch() {
    const ldClient = await init(sdkKey, sdkOptions);
    await ldClient.waitForInitialization({ timeout: 10 });
    const flagValue = await ldClient.variation(flagKey, context, false);

    return new Response(JSON.stringify({ flagKey, flagValue }), { status: 200 });
  }
};
