/**
 * SERVER: Nested Server Component.
 * Demonstrates that server components can evaluate flags and render client components
 * as children — the client component becomes an interactive "island" inside static
 * server-rendered markup.
 */
import ldServer from './lib/ld-server';
import ComponentBox from './component-box';
import FlagBadge from './flag-badge';
import ClientIsland from './client-island';

const FLAG_KEY = 'sample-feature';

export default async function ServerSection() {
  const flagValue = await ldServer.variation(FLAG_KEY, false);

  return (
    <ComponentBox
      env="server"
      filename="server-section.tsx"
      description="Nested Server Component — evaluates flags on the server, then renders a Client Island as a child"
    >
      <FlagBadge flagKey={FLAG_KEY} value={flagValue} />
      {/*
        A server component can import and render a client component directly.
        The client component is sent to the browser as a hydration boundary —
        the server produces its initial HTML, then React takes over in the browser.
      */}
      <ClientIsland />
    </ComponentBox>
  );
}
