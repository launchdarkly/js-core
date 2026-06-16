import { createClient } from '@launchdarkly/node-client-sdk';

// Set clientSideId to your client-side ID.
const clientSideId = process.env.LAUNCHDARKLY_CLIENT_SIDE_ID ?? '';

// Set flagKey to the feature flag key you want to evaluate.
const flagKey = process.env.LAUNCHDARKLY_FLAG_KEY ?? 'sample-feature';

if (!clientSideId) {
  console.error(
    'LaunchDarkly client-side ID is required: set the LAUNCHDARKLY_CLIENT_SIDE_ID environment variable and try again.',
  );
  process.exit(1);
}

if (!flagKey) {
  console.error(
    'LaunchDarkly flag key is required: set the flagKey variable in src/index.ts, or the LAUNCHDARKLY_FLAG_KEY environment variable and try again.',
  );
  process.exit(1);
}

// Set up the evaluation context. This context should appear on your LaunchDarkly contexts
// dashboard soon after you run the demo.
const context = {
  kind: 'user',
  key: 'example-user-key',
  name: 'Sandy',
};

const banner = `        ██
          ██
      ████████
         ███████
██ LAUNCHDARKLY █
         ███████
      ████████
          ██
        ██
`;

function printValueAndBanner(flagValue: unknown) {
  console.log(`*** The '${flagKey}' feature flag evaluates to ${flagValue}.`);
  if (flagValue === true) {
    console.log(banner);
  }
}

const client = createClient(clientSideId, context);

const startResult = await client.start();

if (startResult.status !== 'complete') {
  console.error(
    `*** SDK failed to initialize (${startResult.status}). Please check your internet connection and SDK credential for any typo.`,
  );
  process.exit(1);
}

console.log('*** SDK successfully initialized!');

// Open a streaming subscription for this flag. The SDK opens a streaming connection by
// default (initialConnectionMode = 'streaming'), and this listener reactively prints a
// new line whenever the value changes in LaunchDarkly.
client.on(`change:${flagKey}`, async () => {
  const updated = await client.variation(flagKey, false);
  printValueAndBanner(updated);
});

const initialValue = await client.variation(flagKey, false);
printValueAndBanner(initialValue);

// CI runs the hello app in 'one shot' mode so the CI job can inspect a single line of output.
// Outside CI, the app keeps running so flag changes in LaunchDarkly propagate live.
if (process.env.CI) {
  await client.close();
  process.exit(0);
}
