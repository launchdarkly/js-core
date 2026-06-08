import { createLDReactProvider, LDContext, LDReactProviderOptions } from '@launchdarkly/react-sdk';

const LAUNCHDARKLY_CLIENT_SIDE_ID = import.meta.env.LAUNCHDARKLY_CLIENT_SIDE_ID ?? '';

// The initial evaluation context. This context should appear on your
// LaunchDarkly contexts dashboard soon after you run the demo.
export const initialContext: LDContext = {
  kind: 'user',
  key: 'example-user-key',
  name: 'Sandy',
};

const options: LDReactProviderOptions = {
  ldOptions: {
    // Enable the FDv2 data system. An empty object opts in with default
    // behavior: a streaming connection for real-time flag updates, with
    // polling as a fallback.
    //
    // Data saving mode is an Early Access feature. To pin a specific
    // connection mode instead, use manual mode switching, for example:
    //   dataSystem: {
    //     automaticModeSwitching: { type: 'manual', initialConnectionMode: 'polling' },
    //   },
    dataSystem: {},
  },
};

export const LDReactProvider = createLDReactProvider(
  LAUNCHDARKLY_CLIENT_SIDE_ID,
  initialContext,
  options,
);
