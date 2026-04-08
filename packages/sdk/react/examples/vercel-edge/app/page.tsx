import { createClient } from '@vercel/edge-config';

import { createLDServerSession, LDIsomorphicProvider } from '@launchdarkly/react-sdk/server';
import { init } from '@launchdarkly/vercel-server-sdk';

import App from './App';

// The Vercel SDK reads flag data from Vercel Edge Config instead of connecting
// to LaunchDarkly servers directly, so it uses the client-side ID — not the
// server SDK key.
const clientSideId = process.env.LD_CLIENT_SIDE_ID || '';
const edgeConfig = process.env.VERCEL_EDGE_CONFIG;
const edgeConfigClient = edgeConfig ? createClient(edgeConfig) : null;
const ldBaseClient = clientSideId && edgeConfigClient ? init(clientSideId, edgeConfigClient) : null;

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
  if (!edgeConfigClient) {
    return (
      <div className="error">
        <p>
          Vercel Edge Config is required: set the VERCEL_EDGE_CONFIG environment variable and try
          again.
        </p>
      </div>
    );
  }

  if (!ldBaseClient) {
    return (
      <div className="error">
        <p>
          LaunchDarkly client-side ID is required: set the LD_CLIENT_SIDE_ID environment variable
          and try again.
        </p>
      </div>
    );
  }

  try {
    await ldBaseClient.waitForInitialization();
  } catch {
    return (
      <div className="error">
        <p>
          SDK failed to initialize. Please check your Edge Config connection and LaunchDarkly
          client-side ID for any issues.
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
  // in this render tree can retrieve it via useLDServerSession().
  const session = createLDServerSession(ldBaseClient, context);

  // Wrap the app with LDIsomorphicProvider to bootstrap the browser SDK with
  // server-evaluated flag values.
  return (
    <LDIsomorphicProvider session={session} clientSideId={clientSideId}>
      <App />
    </LDIsomorphicProvider>
  );
}
