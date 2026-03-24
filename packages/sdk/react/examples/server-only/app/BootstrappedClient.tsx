'use client';

import { useBoolVariation } from '@launchdarkly/react-sdk';

/**
 * Client component that evaluates a flag via the bootstrapped react clientSDK.
 * The LDIsomorphicProvider evaluates all flags on the server and passes them
 * to the react client SDK as bootstrap data.
 */
export default function BootstrappedClient({ flagKey }: { flagKey: string }) {
  const flagValue = useBoolVariation(flagKey, false);

  return (
    <p>
      <strong>Client:</strong> feature flag evaluates to {String(flagValue)} (bootstrapped).
    </p>
  );
}
