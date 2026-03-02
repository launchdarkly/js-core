import {
  createClient,
  createLDReactProvider,
  LDContext,
  LDReactClientOptions,
} from '@launchdarkly/react-sdk';

const LAUNCHDARKLY_CLIENT_SIDE_ID = import.meta.env.LAUNCHDARKLY_CLIENT_SIDE_ID ?? '';

// Set LAUNCHDARKLY_CLIENT_SIDE_ID to your LaunchDarkly client-side ID.
const context: LDContext = {
  // Set up the evaluation context. This context should appear on your LaunchDarkly contexts dashboard soon after you run the demo.
  kind: 'user',
  key: 'example-user-key',
  name: 'Sandy',
};

const options: LDReactClientOptions = {
  streaming: true,
};

const client = createClient(LAUNCHDARKLY_CLIENT_SIDE_ID, context, options);

export const LDReactProvider = createLDReactProvider(client);
