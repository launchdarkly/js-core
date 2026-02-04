/**
 * SERVER: Shows the LDIsomorphicProvider bootstrap in action.
 * This component itself doesn't call the session directly — the bootstrap
 * data was already collected by LDIsomorphicProvider in layout.tsx.
 */
import BootstrapClient from './bootstrap-client';
import ComponentBox from './component-box';

export default function BootstrapSection() {
  return (
    <ComponentBox
      env="server"
      filename="bootstrap-section.tsx"
      description="LDIsomorphicProvider bootstrap — layout.tsx ran allFlagsState() on the server; the client receives flag values before any network round-trip"
    >
      <BootstrapClient />
    </ComponentBox>
  );
}
