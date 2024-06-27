import { getLDContext } from '@/app/utils';

import { useLDClientRsc } from '@launchdarkly/react-universal-sdk/server';

export default async function HelloServerComponent() {
  const ldc = await useLDClientRsc(getLDContext());
  const flagValue = ldc.variation('my-boolean-flag-1');

  return (
    <div className="border-2 border-white/20 p-4">
      <p className="text-xl ldgradient">
        {flagValue
          ? 'This flag is evaluating True in a React Server Component'
          : 'This flag is evaluating False in a React Server Component'}
      </p>
    </div>
  );
}
