'use client';

// CLIENT ONLY: this component and createClient/start run only in the browser.
// We use the isomorphic createClient from the main entry so the same API works in both environments.
import { createClient } from '@launchdarkly/react-sdk';
import { useEffect, useState } from 'react';

const flagKey = 'sample-feature';
const context = { kind: 'user' as const, key: 'user-key' };

export default function ClientRendered() {
  const [isOn, setIsOn] = useState(false);

  useEffect(() => {
    // Create client only in the browser to avoid "window is not defined" during SSR.
    const client = createClient(
      process.env.LD_CLIENT_SIDE_ID || 'test-client-side-id',
      context,
    );
    const updateFlag = () => {
      client.variation(flagKey, false).then((value) => setIsOn(!!value));
    };
    client.on(`change:${flagKey}`, updateFlag);
    client.start().then(() => updateFlag());
    return () => client.off(`change:${flagKey}`, updateFlag);
  }, []);

  return (
    <p data-testid="client-flag">
      Client: <strong>{flagKey}</strong> is {isOn ? 'on' : 'off'}
    </p>
  );
}
