'use client';

/**
 * CLIENT: An interactive island rendered inside a Server Component.
 * Imports from ld-client (not ld-server) to avoid pulling server-only modules
 * into the browser bundle. Flag evaluation happens in the browser after hydration,
 * with live streaming updates via the event subscription.
 */
import { useEffect, useState } from 'react';

import ComponentBox from './component-box';
import FlagBadge from './flag-badge';
import ldClient from './lib/ld-client';

const FLAG_KEY = 'sample-feature';

export default function ClientIsland() {
  const [flagValue, setFlagValue] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const update = () => setFlagValue(!!ldClient.variation(FLAG_KEY, false));
    ldClient.waitForInitialization().then(() => {
      setReady(true);
      update();
    });
    ldClient.on(`change:${FLAG_KEY}`, update);
    return () => ldClient.off(`change:${FLAG_KEY}`, update);
  }, []);

  return (
    <ComponentBox
      env="client"
      filename="client-island.tsx"
      description="Client island nested inside ServerSection — evaluates flags in the browser with live streaming updates"
    >
      <FlagBadge flagKey={FLAG_KEY} value={flagValue} live />
      {!ready && <p className="init-text">Initializing client SDK…</p>}
    </ComponentBox>
  );
}
