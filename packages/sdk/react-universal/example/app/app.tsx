import { getLDContext } from '@/app/utils';

import { useLDClientRsc } from '@launchdarkly/react-universal-sdk/server';

export default async function App() {
  const ldc = await useLDClientRsc(getLDContext());
  const flagValue = ldc.variation('dev-test-flag');

  return (
    <p>
      <b>app.tsx</b>
      <br />
      <br />
      context: {JSON.stringify(ldc.getContext())}
      <br />
      flagValue: {flagValue.toString()}
      <br />
    </p>
  );
}
