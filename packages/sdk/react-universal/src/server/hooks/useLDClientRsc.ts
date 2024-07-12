import { cache } from 'react';

import type { LDContext } from '@launchdarkly/node-server-sdk';

import { LDClientRsc } from '../../ldClientRsc';
import { getBootstrap } from '../getBootstrap';

const ldClientRsc = 'ldClientRsc';
const getServerCache = cache(() => new Map<string, any>());

/**
 * Server Components only. This creates and caches an LDClientRsc object
 * using React cache which is available on the server side only.
 *
 * @param context The LDContext for evaluation.
 *
 * @returns An {@link LDClientRsc} object suitable for RSC and server side rendering.
 */
export const useLDClientRsc = async (context: LDContext) => {
  const serverCache = getServerCache();
  let cachedClient = serverCache.get(ldClientRsc);

  if (!cachedClient) {
    const bootstrap = await getBootstrap(context);
    // eslint-disable-next-line no-console
    console.log(`*** create cache ldClientRsc: ${context.key}`);
    cachedClient = new LDClientRsc(context, bootstrap);
    serverCache.set(ldClientRsc, cachedClient);
  } else {
    // eslint-disable-next-line no-console
    console.log(`*** reuse cache ldClientRsc: ${cachedClient.getContext().key}`);
  }

  return cachedClient as LDClientRsc;
};
