import { OpenFeature, ProviderEvents } from '@openfeature/server-sdk';

import { LaunchDarklyProvider } from '@launchdarkly/openfeature-node-server';

// The server-side SDK key is read from the LAUNCHDARKLY_SDK_KEY environment variable.
const sdkKey = process.env.LAUNCHDARKLY_SDK_KEY;

// Set flagKey to the feature flag key you want to evaluate.
const flagKey = process.env.LAUNCHDARKLY_FLAG_KEY || 'sample-feature';

if (!sdkKey) {
  console.error(
    '*** LaunchDarkly SDK key is required: set the LAUNCHDARKLY_SDK_KEY environment variable and try again.',
  );
  process.exit(1);
}

if (!flagKey) {
  console.error(
    "*** LaunchDarkly flag key is required: set the 'flagKey' variable in src/index.ts, or the LAUNCHDARKLY_FLAG_KEY environment variable and try again.",
  );
  process.exit(1);
}

const BANNER = `        ██
          ██
      ████████
         ███████
██ LAUNCHDARKLY █
         ███████
      ████████
          ██
        ██
`;

// Set up the evaluation context. This context should appear on your LaunchDarkly contexts dashboard
// soon after you run the demo.
const context = {
  kind: 'user',
  targetingKey: 'example-user-key',
  name: 'Sandy',
};

let lastFlagValue: boolean | null = null;

function printFlagState(flagValue: boolean): void {
  if (lastFlagValue === flagValue) {
    return;
  }
  console.log(`*** The '${flagKey}' feature flag evaluates to ${flagValue}.\n`);
  if (flagValue) {
    console.log(BANNER);
  }
  lastFlagValue = flagValue;
}

async function main(): Promise<void> {
  const provider = new LaunchDarklyProvider(sdkKey!);

  try {
    await OpenFeature.setProviderAndWait(provider);
    console.log('*** SDK successfully initialized!\n');
  } catch (error) {
    console.error(
      `*** SDK failed to initialize. Please check your internet connection and SDK credential for any typo.\n${error}`,
    );
    process.exit(1);
  }

  const ofClient = OpenFeature.getClient();
  const initialValue = await ofClient.getBooleanValue(flagKey, false, context);
  printFlagState(initialValue);

  // Subscribe to provider configuration changes so the demo reacts to LaunchDarkly flag updates
  // without polling.
  ofClient.addHandler(ProviderEvents.ConfigurationChanged, async (eventDetails) => {
    if (eventDetails?.flagsChanged?.includes(flagKey)) {
      const updatedValue = await ofClient.getBooleanValue(flagKey, false, context);
      printFlagState(updatedValue);
    }
  });

  if (process.env.CI !== undefined) {
    process.exit(0);
  }
}

main().catch((error) => {
  console.error(`*** Unhandled error: ${error}`);
  process.exit(1);
});
