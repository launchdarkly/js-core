import {
  LDContext,
  type LDEvaluationDetailTyped,
  type LDFlagsState,
  type LDFlagsStateOptions,
} from '@launchdarkly/js-server-sdk-common';

export type * from './LDClient';
export type * from './LDServerBaseClient';
export { LDIsomorphicProvider } from './LDIsomorphicProvider';

import { LDServerBaseClient } from './LDServerBaseClient';
import { LDServerSession } from './LDClient';

const CLIENT_SIDE_REASON = { kind: 'ERROR' as const, errorKind: 'CLIENT_NOT_READY' };

function makeNoOpDetail<T>(value: T): LDEvaluationDetailTyped<T> {
  return {
    value,
    variationIndex: null,
    reason: CLIENT_SIDE_REASON,
  };
}

function makeNoOpFlagsState(): LDFlagsState {
  return {
    valid: false,
    getFlagValue: () => null,
    getFlagReason: () => null,
    allValues: () => ({}),
    toJSON: () => ({ $flagsState: {}, $valid: false }),
  };
}

/**
 * Returns true when code is running in a server environment (e.g. Node), false when running in the
 * browser or other client environment.
 */
export function isServer(): boolean {
  return typeof window === 'undefined';
}

function makeNoOpSession(context: LDContext): LDServerSession {
  return {
    initialized: () => false,
    getContext: () => context,
    boolVariation: (_key, defaultValue) => Promise.resolve(defaultValue),
    numberVariation: (_key, defaultValue) => Promise.resolve(defaultValue),
    stringVariation: (_key, defaultValue) => Promise.resolve(defaultValue),
    jsonVariation: (_key, defaultValue) => Promise.resolve(defaultValue),
    boolVariationDetail: (_key, defaultValue) =>
      Promise.resolve(makeNoOpDetail(defaultValue)),
    numberVariationDetail: (_key, defaultValue) =>
      Promise.resolve(makeNoOpDetail(defaultValue)),
    stringVariationDetail: (_key, defaultValue) =>
      Promise.resolve(makeNoOpDetail(defaultValue)),
    jsonVariationDetail: (_key, defaultValue) =>
      Promise.resolve(makeNoOpDetail(defaultValue)),
    allFlagsState: () => Promise.resolve(makeNoOpFlagsState()),
  };
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
 * When called in a browser environment (e.g. during build-time pre-rendering), returns a no-op
 * session that resolves every variation to its default value. This allows server components to
 * render safely at build time without contacting LaunchDarkly.
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
    return makeNoOpSession(context);
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
 * When not running on the server (e.g. in the browser), returns a no-op client that returns default
 * values and does not call the underlying LaunchDarkly client.
 */
export function createReactServerClient(
  client: LDServerBaseClient,
  options: { contextProvider: { getContext: () => LDContext } },
): LDServerSession {
  const context = options.contextProvider.getContext();
  return createLDServerSession(client, context);
}
