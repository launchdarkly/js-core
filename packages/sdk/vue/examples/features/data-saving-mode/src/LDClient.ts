import type { LDContext, LDVueClientOptions } from '@launchdarkly/vue-client-sdk';

export const LAUNCHDARKLY_CLIENT_SIDE_ID = import.meta.env.LAUNCHDARKLY_CLIENT_SIDE_ID ?? '';

// The initial evaluation context. This context should appear on your
// LaunchDarkly contexts dashboard soon after you run the demo.
export const initialContext: LDContext = {
  kind: 'user',
  key: 'example-user-key',
  name: 'Sandy',
};

// Enable the FDv2 data system. An empty object opts in with default behavior:
// a streaming connection for real-time flag updates, with polling as a fallback.
//
// Data saving mode is an Early Access feature. The `dataSystem` option is not yet
// on the stable BrowserOptions type -- cast required until it reaches GA. To pin
// a specific connection mode instead, use manual mode switching, for example:
//   dataSystem: {
//     automaticModeSwitching: { type: 'manual', initialConnectionMode: 'polling' },
//   },
export const ldOptions = { dataSystem: {} } as LDVueClientOptions;
