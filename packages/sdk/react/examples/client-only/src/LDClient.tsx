import { createLDReactProvider, LDContext, LDReactProviderOptions } from '@launchdarkly/react-sdk';

const LAUNCHDARKLY_CLIENT_SIDE_ID = import.meta.env.LAUNCHDARKLY_CLIENT_SIDE_ID ?? '';

const context: LDContext = {
  // Set up the evaluation context. This context should appear on your LaunchDarkly contexts dashboard soon after you run the demo.
  kind: 'user',
  key: 'example-user-key',
  name: 'Sandy',
};

const options: LDReactProviderOptions = {
  ldOptions: { streaming: true },
};

export const LDReactProvider = createLDReactProvider(LAUNCHDARKLY_CLIENT_SIDE_ID, context, options);
