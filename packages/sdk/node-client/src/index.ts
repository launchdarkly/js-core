/**
 * This is the API reference for the LaunchDarkly Client-Side SDK for Node.js.
 *
 * In typical usage you will call {@link createClient} once at startup time to obtain an
 * instance of {@link LDClient}, then call `client.start()` to begin initialization.
 *
 * @packageDocumentation
 */
import type { LDContext } from '@launchdarkly/js-client-sdk-common';

import basicLogger from './basicLogger';
import type { LDClient, LDStartOptions } from './LDClient';
import type { LDPlugin } from './LDPlugin';
import { makeClient } from './NodeClient';
import type { LDTLSOptions, NodeOptions } from './NodeOptions';

export * from './LDCommon';

/** @internal */
export { resetNodeStorage } from './platform/NodeStorage';

export type {
  NodeOptions as LDOptions,
  LDClient,
  LDPlugin,
  LDStartOptions,
  LDTLSOptions,
};

export { basicLogger };

/**
 * Creates a LaunchDarkly client. The client is not ready until {@link LDClient.start}
 * is called -- after which the first identify with `initialContext` runs and the returned
 * promise resolves.
 *
 * @param envKey The LaunchDarkly client-side ID for the environment.
 * @param initialContext The context used for the first identify on `start()`.
 * @param options Optional configuration.
 * @returns The client instance. Call `client.start()` before using variations or calling
 * `identify()` for context changes.
 */
export function createClient(
  envKey: string,
  initialContext: LDContext,
  options: NodeOptions = {},
): LDClient {
  return makeClient(envKey, initialContext, options);
}
