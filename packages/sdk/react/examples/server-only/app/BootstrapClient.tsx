'use client';

import { useBoolVariation } from '@launchdarkly/react-sdk';

/**
 * Client component that evaluates a flag via the bootstrapped browser SDK.
 * The LDIsomorphicProvider evaluates all flags on the server and passes them
 * to the browser SDK as bootstrap data.
 */
export default function BootstrapClient({ flagKey }: { flagKey: string }) {
  const flagValue = useBoolVariation(flagKey, false);

  return (
    <p>
      <strong>Client:</strong> The {flagKey} feature flag evaluates to {String(flagValue)}.
    </p>
  );
}
