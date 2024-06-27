'use client';

import { useLDClient } from '@launchdarkly/react-universal-sdk/client';

export default function HelloClientComponent() {
  const ldc = useLDClient();
  const flagValue = ldc.variation('dev-test-flag');

  return (
    <div className="border-2 border-white/20  p-4 ">
      <p className="ldgradient text-xl">
        {flagValue
          ? 'This flag is evaluating True running Client-Side JavaScript'
          : 'This flag is evaluating False running Client-Side JavaScript'}
      </p>
    </div>
  );
}
