import { cookies } from 'next/headers';

import type { LDContext } from '@launchdarkly/node-server-sdk';
import { isServer } from '@launchdarkly/react-universal-sdk';

const anonymous: LDContext = { kind: 'user', key: 'anon-key', anonymous: true };

/**
 * This is an example of how you can source your LDContext. You may also
 * retrieve it from a database or from request headers.
 *
 * This example looks for an LDContext in a server cookie called 'ld'.
 *
 * @param def The default context if none is found in cookies. As final
 * fallback, anonymous is returned.
 *
 */
export function getLDContext(def?: LDContext) {
  let context = def ?? anonymous;

  if (isServer) {
    const ld = cookies().get('ld');
    if (!ld) {
      console.log(`*** no cookie, defaulting to ${JSON.stringify(context)} ***`);
    } else {
      console.log(`*** found cookie ${JSON.stringify(ld.value)} ***`);
      context = JSON.parse(ld.value);
    }
  }

  return context;
}
