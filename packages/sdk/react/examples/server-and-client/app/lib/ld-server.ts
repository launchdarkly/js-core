/**
 * SERVER ONLY: This module must only be imported by Server Components or other server-only code.
 * Do not import this file from any 'use client' component.
 *
 * Creates the LaunchDarkly Node client and React server client, then federates the
 * shared isomorphic client (from ld-client.ts) so the same LDIsomorphicClient API
 * can be used in both Server Components and Client Components.
 */
import { init } from '@launchdarkly/node-server-sdk';
import { createReactServerClient } from '@launchdarkly/react-sdk/server';
import { defaultContext } from './ld-context';

const ldClient = init(process.env.LAUNCHDARKLY_SDK_KEY || '');

const serverClient = createReactServerClient(ldClient, {
  contextProvider: {
    getContext: () => defaultContext,
  },
});

export default serverClient;
