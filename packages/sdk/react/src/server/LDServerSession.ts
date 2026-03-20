import { cache } from 'react';

import { LDContext, type LDFlagsStateOptions } from '@launchdarkly/js-server-sdk-common';

import { LDServerSession } from './LDClient';
import { LDServerBaseClient } from './LDServerBaseClient';

// cache() creates a per-request memoized store — each React render tree (request)
// gets its own isolated instance. The store is populated by createLDServerSession
// and read by useLDServerSession.
const withCache = cache(() => ({ session: null as LDServerSession | null }));

/**
 * Boundary check for server only code. Given that we are assuming a React ecosystem,
 * simply checking for the presence of window should be sufficient.
 */
function isServer(): boolean {
  return typeof window === 'undefined';
}

/**
 * Creates a LaunchDarkly server SDK client that is scoped to a specific context.
 *
 * @remarks
 * **NOTE:** We recommend using the {@link createLDServerSession} function to create your server session
 * instead of directly calling this function.
 *
 * This function is provided to allow the caller to have more control over handling their scoped LD client.
 * If using this function, the caller is responsible for managing the lifecycle of the created wrapped client.
 *
 * @throws {Error} If called in a browser environment. This function must only be called on the
 *   server. Ensure the module that calls this is not imported from client components.
 *
 * @example
 * ```ts
 * // lib/ld-server.ts
 * import { init } from '@launchdarkly/node-server-sdk';
 * import { createLDServerSession } from '@launchdarkly/react-sdk/server';
 *
 * const ldBaseClient = await init(process.env.LAUNCHDARKLY_SDK_KEY || '');
 * export const serverSession = createLDServerSession(ldBaseClient, defaultContext);
 * ```
 *
 * @param client Any LaunchDarkly server SDK client that satisfies {@link LDServerBaseClient}.
 * @param context The context to bind to this session. Typically resolved from the request
 *   (e.g. from auth tokens, cookies, or headers).
 * @returns An {@link LDServerSession} scoped to the given context.
 */
export function createLDServerWrapper(
  client: LDServerBaseClient,
  context: LDContext,
): LDServerSession {
  if (!isServer()) {
    throw new Error(
      'createLDServerWrapper must only be called on the server. ' +
        'Ensure this module is not imported from client components.',
    );
  }

  return {
    initialized: () => client.initialized(),
    getContext: () => context,
    boolVariation: (key, defaultValue) => client.boolVariation(key, context, defaultValue),
    numberVariation: (key, defaultValue) => client.numberVariation(key, context, defaultValue),
    stringVariation: (key, defaultValue) => client.stringVariation(key, context, defaultValue),
    jsonVariation: (key, defaultValue) => client.jsonVariation(key, context, defaultValue),
    boolVariationDetail: (key, defaultValue) =>
      client.boolVariationDetail(key, context, defaultValue),
    numberVariationDetail: (key, defaultValue) =>
      client.numberVariationDetail(key, context, defaultValue),
    stringVariationDetail: (key, defaultValue) =>
      client.stringVariationDetail(key, context, defaultValue),
    jsonVariationDetail: (key, defaultValue) =>
      client.jsonVariationDetail(key, context, defaultValue),
    allFlagsState: (options?: LDFlagsStateOptions) => client.allFlagsState(context, options),
  };
}

/**
 * Creates a per-request evaluation scope by binding an {@link LDServerBaseClient} to a specific
 * context.
 *
 * @param client Any LaunchDarkly server SDK client that satisfies {@link LDServerBaseClient}.
 * @param context The context to bind to this session. Typically resolved from the request
 *   (e.g. from auth tokens, cookies, or headers).
 * @returns An {@link LDServerSession} scoped to the given context.
 */
export function createLDServerSession(
  client: LDServerBaseClient,
  context: LDContext,
): LDServerSession {
  const session = createLDServerWrapper(client, context);

  withCache().session = session;

  return session;
}

/**
 * Returns the {@link LDServerSession} scoped to the current request.
 *
 * @remarks
 * **NOTE:** This function is only used to retrieve the session stored by {@link createLDServerSession}.
 * You must call {@link createLDServerSession} before calling this function or it will return a null value.
 *
 * @example
 * ```ts
 * // app.tsx (entry point)
 * import { createLDServerSession } from '@launchdarkly/react-sdk/server';
 * const session = createLDServerSession(client, context);
 *
 * // component.ts
 * import { useLDServerSession } from '@launchdarkly/react-sdk/server';
 *
 * export default function MyComponent() {
 *   const session = useLDServerSession();
 *   if (session) {
 *     const flagValue = await session.boolVariation('my-flag', false);
 *     return <div>{flagValue ? 'Yes' : 'No'}</div>;
 *   }
 *   return <div>Loading...</div>;
 * }
 * ```
 *
 * @returns The {@link LDServerSession} scoped to the current request, or `null` if no session has been created.
 */
export function useLDServerSession(): LDServerSession | null {
  if (!isServer()) {
    throw new Error(
      'useLDServerSession must only be called on the server. ' +
        'Ensure this module is not imported from client components.',
    );
  }

  const { session } = withCache();
  if (!session) {
    return null;
  }

  return session;
}
