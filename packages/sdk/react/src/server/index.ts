import { LDContext, type LDFlagsStateOptions } from '@launchdarkly/js-server-sdk-common';

import { LDServerSession } from './LDClient';
import { LDServerBaseClient } from './LDServerBaseClient';

export type * from './LDClient';
export type * from './LDServerBaseClient';
export { LDIsomorphicProvider } from './LDIsomorphicProvider';

/**
 * Returns true when code is running in a server environment (e.g. Node), false when running in the
 * browser or other client environment.
 */
export function isServer(): boolean {
  return typeof window === 'undefined';
}

/**
 * Creates a per-request evaluation scope by binding an {@link LDServerBaseClient} to a specific
 * context.
 *
 * @remarks
 * Call this once per request (or share a session when the context is static, e.g. a shared
 * anonymous context). The returned {@link LDServerSession} exposes the same variation API as the
 * server SDK, but without the `context` parameter — the context is bound at creation time.
 *
 * @throws {Error} If called in a browser environment. This function must only be called on the
 *   server. Ensure the module that calls this is not imported from client components.
 * 
 * @privateRemarks
 * TODO: I think throwing an error might be better than just silently failing here.
 * While the client -> server boundary is most likely a security loosening boundary,
 * the server -> client boundary needs to be considered more carefully. Open to discussion.
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
export function createLDServerSession(
  client: LDServerBaseClient,
  context: LDContext,
): LDServerSession {
  if (!isServer()) {
    throw new Error(
      'createLDServerSession must only be called on the server. ' +
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
 * @deprecated Use {@link createLDServerSession} instead.
 *
 * @experimental
 * This function is experimental and may change in the future.
 *
 * Creates a restricted version of the common server client that is used for server side rendering.
 */
export function createReactServerClient(
  client: LDServerBaseClient,
  options: { contextProvider: { getContext: () => LDContext } },
): LDServerSession {
  const context = options.contextProvider.getContext();
  return createLDServerSession(client, context);
}
