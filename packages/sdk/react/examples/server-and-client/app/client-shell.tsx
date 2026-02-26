'use client';

/**
 * CLIENT: A client component that accepts server-rendered children.
 * Because `children` is passed from the parent server component (page.tsx), Next.js
 * renders those children on the server first — the client component never re-renders
 * them. This is the key pattern for composing server and client components:
 *   <ClientShell>          ← interactive client wrapper (live flag updates)
 *     <ServerContent />    ← static server-rendered slot
 *   </ClientShell>
 */
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import ComponentBox from './component-box';
import FlagBadge from './flag-badge';
import ldClient from './lib/ld-client';

const FLAG_KEY = 'sample-feature';

export default function ClientShell({ children }: { children: ReactNode }) {
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
      filename="client-shell.tsx"
      description="Client Component — evaluates its own flag live in the browser, while children are pre-rendered server HTML"
    >
      <FlagBadge flagKey={FLAG_KEY} value={flagValue} live />
      {!ready && <p className="init-text">Initializing client SDK…</p>}
      {/* Server-rendered children are slotted here — they never re-render on the client */}
      {children}
    </ComponentBox>
  );
}
