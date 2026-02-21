// SERVER: this is a Server Component; evaluation runs on the server only.
import { ldClient, serverClient } from './lib/ld-server';
import ClientRendered from './client-rendered';

const flagKey = 'sample-feature';

export default async function Home() {
  await ldClient.waitForInitialization({ timeout: 10 });

  // SERVER: evaluation runs on server only via serverClient from ld-server.
  const serverFlagValue = await serverClient.variation(flagKey, false);

  return (
    <>
      <p data-testid="server-flag">
        Server: <strong>{flagKey}</strong> is {serverFlagValue ? 'on' : 'off'}
      </p>
      <ClientRendered />
    </>
  );
}
