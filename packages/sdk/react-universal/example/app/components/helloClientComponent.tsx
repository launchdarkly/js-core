'use client';

import { useState } from 'react';
import { useCookies } from 'react-cookie';

import type { JSSdk } from '@launchdarkly/react-universal-sdk';
import { useLDClient } from '@launchdarkly/react-universal-sdk/client';

export default function HelloClientComponent() {
  const ldc = useLDClient();
  const [_, setCookie] = useCookies(['ld']);
  const [contextKey, setContextKey] = useState('');

  // WARNING: Using the ldClient to evaluate flags directly like this in prod
  // can result in high event volumes. This example is contrived and is meant for
  // demo purposes only. The recommended way is to utilise the `useVariation` hooks
  // which should be supported soon.
  const flagValue = ldc.variation('my-boolean-flag-1');

  function onClickLogin() {
    const context = { kind: 'user', key: contextKey };
    (ldc as JSSdk).identify(context).then(() => {
      console.log('identify successful, persisting to cookies');
      setCookie('ld', context);
    });
  }

  return (
    <div className="border-2 border-white/20  p-4 ">
      <div>
        <p className="ldgradient text-xl">
          {flagValue
            ? 'This flag is evaluating True running Client-Side JavaScript'
            : 'This flag is evaluating False running Client-Side JavaScript'}
        </p>
      </div>
      <br />
      <div>
        <label>
          Context key: &nbsp;
          <input value={contextKey} onChange={(e) => setContextKey(e.target.value)} />
        </label>
      </div>
      <br />
      <button role="button" className="login" onClick={onClickLogin}>
        Login
      </button>
    </div>
  );
}
