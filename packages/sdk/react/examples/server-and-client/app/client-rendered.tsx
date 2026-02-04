'use client';

// CLIENT: same LDIsomorphicClient as the server (page.tsx). Import from ld-client so we
// do not pull server-only code into the client bundle; ld-server federates this client
// for Server Components.
import ldClient from './lib/ld-client';
import { useEffect, useState } from 'react';

const flagKey = 'sample-feature';

export default function ClientRendered() {
  const [isOn, setIsOn] = useState(false);

  useEffect(() => {
    const updateFlag = () => {
      const value = ldClient.variation(flagKey, false)
      console.log('value', value);
      setIsOn(!!value);
    };
    ldClient!.on(`change:${flagKey}`, updateFlag);
    ldClient!.waitForInitialization().then(() => updateFlag());
    return () => ldClient!.off(`change:${flagKey}`, updateFlag);
  }, []);

  return (
    <p data-testid="client-flag">
      Client: <strong>{flagKey}</strong> is {isOn ? 'on' : 'off'}
    </p>
  );
}
