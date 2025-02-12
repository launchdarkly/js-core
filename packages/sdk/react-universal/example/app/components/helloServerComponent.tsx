import { getLDContext } from '@/app/utils';

import { useBoolVariationDetailRsc } from '@launchdarkly/react-universal-sdk/server';

export default async function HelloServerComponent() {
  const result = await useBoolVariationDetailRsc('my-boolean-flag-1', getLDContext(), false);

  return (
    <div className="border-2 border-white/20 p-4">
      <p className="text-xl ldgradient">
        {result.value
          ? 'This flag is evaluating True in a React Server Component'
          : 'This flag is evaluating False in a React Server Component'}
      </p>
    </div>
  );
}
