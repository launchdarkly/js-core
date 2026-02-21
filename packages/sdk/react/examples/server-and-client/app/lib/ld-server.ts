/**
 * SERVER ONLY: This module must only be imported by Server Components or other server-only code.
 * Do not import this file from any 'use client' component.
 *
 * Creates the LaunchDarkly Node client and React server client for RSC evaluation.
 */
import { init } from '@launchdarkly/node-server-sdk';
import { createReactServerClient } from '@launchdarkly/react-sdk/server';

const ldClient = init(process.env.LAUNCHDARKLY_SDK_KEY || '');

const defaultContext = {
  kind: 'user' as const,
  key: 'example-user-key',
  name: 'Sandy',
};

const serverClient = createReactServerClient(ldClient, {
  contextProvider: {
    getContext: () => defaultContext,
  },
});

export { ldClient, serverClient, defaultContext };
