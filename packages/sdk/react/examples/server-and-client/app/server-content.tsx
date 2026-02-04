/**
 * SERVER: A Server Component designed to be passed as children to a Client Component.
 * The parent server component (page.tsx) renders this on the server and passes the
 * resulting React tree as the `children` prop to ClientShell. This lets server-evaluated
 * flag values appear inside a client component boundary without re-running on the client.
 */
import ldServer from './lib/ld-server';
import ComponentBox from './component-box';
import FlagBadge from './flag-badge';

const FLAG_KEY = 'sample-feature';

export default async function ServerContent() {
  const flagValue = await ldServer.variation(FLAG_KEY, false);

  return (
    <ComponentBox
      env="server"
      filename="server-content.tsx"
      description="Server Component passed as children to ClientShell — rendered on the server and slotted into the client component"
    >
      <FlagBadge flagKey={FLAG_KEY} value={flagValue} />
    </ComponentBox>
  );
}
