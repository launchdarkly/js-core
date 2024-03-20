// import Welcome from '@/app/welcome';

// import { LDContext, serverSideLDClient } from '@launchdarkly/react-sdk';

export default async function Home() {
  // TODO: set LDContext in middleware, not in a component
  // const context: LDContext = { kind: 'user', key: 'test-user-key-1' };
  // const v = await serverSideLDClient.variation('dev-test-flag', context, false);

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">welcome</main>
  );
}
