'use client';

import { useBoolVariation, useInitializationStatus } from '@launchdarkly/react-sdk';

const flagKey = 'sample-feature';

export default function ClientRendered() {
  const isOn = useBoolVariation(flagKey, false);
  const { status } = useInitializationStatus();

  return (
    <p data-testid="client-flag">
      Client ({status}): <strong>{flagKey}</strong> is {isOn ? 'on' : 'off'}
    </p>
  );
}
