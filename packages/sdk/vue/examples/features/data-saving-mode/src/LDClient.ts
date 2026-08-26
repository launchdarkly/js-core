import type { LDContext, LDVueClientOptions } from '@launchdarkly/vue-client-sdk';

export const LAUNCHDARKLY_CLIENT_SIDE_ID = import.meta.env.LAUNCHDARKLY_CLIENT_SIDE_ID ?? '';

// The initial evaluation context. This context should appear on your
// LaunchDarkly contexts dashboard soon after you run the demo.
export const initialContext: LDContext = {
  kind: 'user',
  key: 'example-user-key',
  name: 'Sandy',
};

// Enable the FDv2 data system. An empty object opts in with the browser default:
// a one-time flag fetch at page load (cache, then polling, then streaming as
// fallbacks), with no further updates afterward.
export const ldOptions: LDVueClientOptions = { dataSystem: {} };
