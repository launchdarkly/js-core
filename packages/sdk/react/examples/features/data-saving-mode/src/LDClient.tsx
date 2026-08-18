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
    // Enable the FDv2 data system. An empty object opts in with the browser
    // default: a one-time flag fetch at page load (cache, then polling, then
    // streaming as fallbacks), with no further updates afterward.
    //
    // Data saving mode is an Early Access feature. To get live updates, or to
    // pin a specific connection mode, use manual mode switching, for example:
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
