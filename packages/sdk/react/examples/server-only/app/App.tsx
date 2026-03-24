import { useLDServerSession } from '@launchdarkly/react-sdk/server';

import BootstrapClient from './BootstrapClient';

// The flag key to evaluate. Override with the LAUNCHDARKLY_FLAG_KEY environment variable.
const flagKey = process.env.LAUNCHDARKLY_FLAG_KEY || 'sample-feature';

export default async function App() {
  // The session was stored here by createLDServerSession() in the parent page.
  const session = useLDServerSession();

  if (!session) {
    return (
      <p className="no-session">
        No LaunchDarkly session found. Ensure createLDServerSession() is called before rendering
        this component.
      </p>
    );
  }

  const flagValue = await session.boolVariation(flagKey, false);
  const ctx = session.getContext() as { name?: string; key: string };

  console.log('[LaunchDarkly] Flag evaluation:', {
    flagKey,
    flagValue,
    context: session.getContext(),
  });

  return (
    <div className={`app ${flagValue ? 'app--on' : 'app--off'}`}>
      <p className="flag-key">Feature flag: {flagKey}</p>
      <p className="context">Context: {ctx.name ?? ctx.key}</p>
      <p>
        <strong>Server:</strong> feature flag evaluates to {String(flagValue)} (server-side rendered).
      </p>
      <BootstrapClient flagKey={flagKey} />
    </div>
  );
}
