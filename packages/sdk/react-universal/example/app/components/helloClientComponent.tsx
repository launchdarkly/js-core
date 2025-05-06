'use client';

import { useBoolVariationDetail } from '@launchdarkly/react-universal-sdk/client';

export default function HelloClientComponent() {
  // You need to set evaluationReasons to true when initializing the LDProvider to useVariationDetail.
  // Note: in the future evaluationReasons will be renamed withReasons.
  const detail = useBoolVariationDetail('my-boolean-flag-1', false);

  return (
    <div className="border-2 border-white/20  p-4 ">
      <div>
        <p className="ldgradient text-xl">
          {detail.value
            ? 'This flag is evaluating True running Client-Side JavaScript'
            : 'This flag is evaluating False running Client-Side JavaScript'}
        </p>
        <p>Reason: {detail.reason?.kind ?? 'reason is null'}</p>
      </div>
    </div>
  );
}
