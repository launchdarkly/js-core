/**
 * SERVER ONLY: This module must only be imported by Server Components or other server-only code.
 * Do not import this file from any 'use client' component.
 *
 * Creates the LaunchDarkly Node client and a server session bound to the default context.
 * The session can be used directly in Server Components for flag evaluation, and is also
 * passed to LDIsomorphicProvider in layout.tsx to bootstrap the client-side SDK.
 */
import { init } from '@launchdarkly/node-server-sdk';
import { createLDServerSession } from '@launchdarkly/react-sdk/server';

import { defaultContext } from './ld-context';

const ldBaseClient = await init(process.env.LAUNCHDARKLY_SDK_KEY || '');

// Session can be created per-request or shared when context is static.
// Here we share a single session for the static default context.
export const serverSession = createLDServerSession(ldBaseClient, defaultContext);

export default serverSession;
