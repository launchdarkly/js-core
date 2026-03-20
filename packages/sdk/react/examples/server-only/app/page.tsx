import { init } from '@launchdarkly/node-server-sdk';
import { createLDServerSession } from '@launchdarkly/react-sdk/server';

import App from './App';

// The base client is a module-level singleton — initialized once for the lifetime of the
// Node.js process and shared across all incoming requests.
const sdkKey = process.env.LAUNCHDARKLY_SDK_KEY || '';
const ldBaseClient = sdkKey ? init(sdkKey) : null;

// Select via ?context=sandy|jamie|alex (defaults to sandy).
const PRESET_CONTEXTS = {
  sandy: { kind: 'user' as const, key: 'example-user-key', name: 'Sandy' },
  jamie: { kind: 'user' as const, key: 'user-jamie', name: 'Jamie' },
  alex: { kind: 'user' as const, key: 'user-alex', name: 'Alex' },
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ context?: string }>;
}) {
  if (!ldBaseClient) {
    return (
      <div className="error">
        <p>
          LaunchDarkly SDK key is required: set the LAUNCHDARKLY_SDK_KEY environment variable and
          try again.
        </p>
      </div>
    );
  }

  try {
    await ldBaseClient.waitForInitialization({ timeout: 10 });
  } catch {
    return (
      <div className="error">
        <p>
          SDK failed to initialize. Please check your internet connection and SDK credential for any
          typo.
        </p>
      </div>
    );
  }

  // Resolve the evaluation context from the ?context= query parameter.
  // In a real app this would come from authentication tokens, cookies, or session data.
  const { context: contextKey = 'sandy' } = await searchParams;
  const context =
    PRESET_CONTEXTS[contextKey as keyof typeof PRESET_CONTEXTS] ?? PRESET_CONTEXTS.sandy;

  // Create a per-request session bound to this user's context.
  // createLDServerSession also stores the session in React's cache() so any Server Component
  // in this render tree can retrieve it via useLDServerSession() — no prop drilling needed.
  createLDServerSession(ldBaseClient, context);

  return <App />;
}
