import { createClient } from '@vercel/edge-config';

import { init, type LDClient } from '@launchdarkly/vercel-server-sdk';

// Set flagKey to the feature flag key you want to evaluate.
export const flagKey = process.env.LAUNCHDARKLY_FLAG_KEY || 'sample-feature';

// Set up the evaluation context. This context should appear on your
// LaunchDarkly contexts dashboard soon after you run the demo.
export const context = { kind: 'user' as const, key: 'example-user-key', name: 'Sandy' };

// Header used by the middleware to pass the evaluated flag value to the page
// for server-rendered initial state.
export const FLAG_HEADER = 'x-ld-flag-value';

// The Vercel SDK reads flag data from Vercel Edge Config instead of connecting
// to LaunchDarkly servers directly, so it uses the client-side ID — not the
// server SDK key.
let cachedClient: LDClient | null = null;

export function getLdEdgeClient(): LDClient | null {
  if (cachedClient) {
    return cachedClient;
  }

  const clientSideId = process.env.LD_CLIENT_SIDE_ID;
  const edgeConfig = process.env.EDGE_CONFIG;

  if (!clientSideId || !edgeConfig) {
    return null;
  }

  cachedClient = init(clientSideId, createClient(edgeConfig));
  return cachedClient;
}
