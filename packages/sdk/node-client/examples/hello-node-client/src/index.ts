import { createClient } from '@launchdarkly/node-client-sdk';

const clientSideId = process.env.LAUNCHDARKLY_CLIENT_SIDE_ID;
const flagKey = process.env.LAUNCHDARKLY_FLAG_KEY ?? 'sample-feature';

if (!clientSideId) {
  console.error('Set LAUNCHDARKLY_CLIENT_SIDE_ID before running this example.');
  process.exit(1);
}

const context = {
  kind: 'user',
  key: 'example-user-key',
  name: 'Sandy',
};

console.log('Initializing LaunchDarkly client...');

const client = createClient(clientSideId, context);
const startResult = await client.start({ timeout: 5 });

if (startResult.status === 'complete') {
  console.log('Initialized.');
  const value = await client.variation(flagKey, false);
  console.log(`The ${flagKey} feature flag evaluates to ${value}.`);
} else {
  console.error(`Failed to initialize (${startResult.status}).`);
}

await client.close();
