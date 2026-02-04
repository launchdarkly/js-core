'use client';

/**
 * CLIENT: Demonstrates that bootstrapped flags are available immediately
 * on first render — no loading flash — because LDIsomorphicProvider
 * passed server-evaluated values to the client SDK via bootstrap.
 */
import { useBoolVariation, useInitializationStatus } from '@launchdarkly/react-sdk';

import ComponentBox from './component-box';
import FlagBadge from './flag-badge';

const FLAG_KEY = 'sample-feature';

export default function BootstrapClient() {
  const flagValue = useBoolVariation(FLAG_KEY, false);
  const { status } = useInitializationStatus();

  return (
    <ComponentBox
      env="client"
      filename="bootstrap-client.tsx"
      description="Bootstrap demo — flag value is available immediately from server-evaluated bootstrap data, no loading flash"
    >
      <FlagBadge flagKey={FLAG_KEY} value={flagValue} live />
      <p className="init-text">
        SDK status: <strong>{status}</strong>
        {status !== 'complete' && ' (flag value already correct from bootstrap)'}
      </p>
    </ComponentBox>
  );
}
