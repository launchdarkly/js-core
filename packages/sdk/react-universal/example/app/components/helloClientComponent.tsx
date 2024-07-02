'use client';

import { useLDClient } from '@launchdarkly/react-universal-sdk/client';

export default function HelloClientComponent() {
  const ldc = useLDClient();

  // WARNING: Using the ldClient to evaluate flags directly like this in prod
  // can result in high event volumes. This example is contrived and is meant for
  // demo purposes only. The recommended way is to utilise the `useVariation` hooks
  // which should be supported soon.
  const flagValue = ldc.variation('my-boolean-flag-1');

  return (
    <div className="border-2 border-white/20  p-4 ">
      <div>
        <p className="ldgradient text-xl">
          {flagValue
            ? 'This flag is evaluating True running Client-Side JavaScript'
            : 'This flag is evaluating False running Client-Side JavaScript'}
        </p>
      </div>
    </div>
  );
}
