/**
 * SERVER: Root Server Component.
 * Orchestrates the interleaved server/client component tree, demonstrating three
 * key composition patterns in Next.js App Router:
 *
 *   Pattern A — Server → Client (island):
 *     page.tsx → ServerSection → ClientIsland
 *     A server component renders a client component as a child. The client
 *     component becomes an interactive island with live flag updates.
 *
 *   Pattern B — Server → Client (children slot):
 *     page.tsx → ClientShell ← ServerContent (passed as children)
 *     A server component passes another server component as children to a
 *     client component. The server children are rendered on the server and
 *     slotted into the client component without re-rendering on the client.
 *
 *   Pattern C — LDIsomorphicProvider bootstrap:
 *     layout.tsx → LDIsomorphicProvider → BootstrapSection → BootstrapClient
 *     The layout runs allFlagsState() on the server and bootstraps the client
 *     SDK — flag values are available immediately without a network round-trip.
 */
import BootstrapSection from './bootstrap-section';
import ClientShell from './client-shell';
import ComponentBox from './component-box';
import FlagBadge from './flag-badge';
import serverSession from './lib/ld-server';
import ServerContent from './server-content';
import ServerSection from './server-section';

const FLAG_KEY = 'sample-feature';

export default async function Home() {
  const flagValue = await serverSession.boolVariation(FLAG_KEY, false);

  return (
    <main className="page-main">
      <h1 className="page-heading">LaunchDarkly React SDK</h1>
      <p className="page-subheading">Server + Client Component Demo</p>

      <details className="tree-details" open>
        <summary className="tree-summary">Component tree</summary>
        <pre className="tree-pre">
          {[
            'page.tsx                  ⚙ SERVER  (root)',
            '├── ServerSection         ⚙ SERVER  (pattern A: nested server)',
            '│   └── ClientIsland      ⚡ CLIENT  (pattern A: island inside server)',
            '├── ClientShell           ⚡ CLIENT  (pattern B: client wrapper)',
            '│   └── ServerContent     ⚙ SERVER  (pattern B: server as client children)',
            '└── BootstrapSection      ⚙ SERVER  (pattern C: isomorphic bootstrap)',
            '    └── BootstrapClient   ⚡ CLIENT  (pattern C: no-flash client island)',
          ].join('\n')}
        </pre>
      </details>

      <ComponentBox
        env="server"
        filename="page.tsx"
        description="Root Server Component — evaluates flags at request time and composes the component tree"
      >
        <FlagBadge flagKey={FLAG_KEY} value={flagValue} />

        {/*
          Pattern A: server → client island
          ServerSection is a server component; it imports and renders ClientIsland
          (a client component) as a direct child. ClientIsland hydrates in the
          browser and subscribes to live flag updates.
        */}
        <ServerSection />

        {/*
          Pattern B: server children passed to a client component
          ClientShell has 'use client'. We pass ServerContent (a server component)
          as its children from here (a server component). Next.js renders
          ServerContent on the server and slots the HTML into ClientShell —
          ClientShell never receives or re-renders the server children.
        */}
        <ClientShell>
          <ServerContent />
        </ClientShell>

        {/*
          Pattern C: LDIsomorphicProvider bootstrap
          layout.tsx wraps the entire app in LDIsomorphicProvider, which runs
          allFlagsState() on the server and passes the result as bootstrap data
          to the browser client. BootstrapClient receives flag values on first
          render — no loading flash, no network round-trip required.
        */}
        <BootstrapSection />
      </ComponentBox>
    </main>
  );
}
