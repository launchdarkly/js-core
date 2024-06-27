import App from '@/app/app';
import LDButton from '@/app/LDButton';
import { getLDContext } from '@/app/utils';
import Link from 'next/link';

import { useLDClientRsc } from '@launchdarkly/react-universal-sdk/server';

// Server Components must useLDClientRsc for evaluation.
export default async function Page() {
  const ldc = await useLDClientRsc(getLDContext());
  const flagValue = ldc.variation('dev-test-flag');

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <b>page.tsx</b>
      <br />
      <br />
      context: {JSON.stringify(ldc.getContext())}
      <br />
      flagValue: {flagValue.toString()}
      <br />
      <App />
      <br />
      <LDButton />
      <Link href="/invoice">Invoice</Link>
    </main>
  );
}
