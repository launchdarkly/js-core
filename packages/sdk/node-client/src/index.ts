/**
 * This is the API reference for the LaunchDarkly Client-Side SDK for Node.js.
 *
 * In typical usage, you will call {@link createClient} once at startup time to obtain an instance of
 * {@link LDClient}, which provides access to all of the SDK's functionality.
 *
 * For more information, see the [SDK Reference Guide](https://docs.launchdarkly.com/sdk/client-side/node-js).
 *
 * @packageDocumentation
 */
import type { LDContext } from '@launchdarkly/js-client-sdk-common';

import basicLogger from './basicLogger';
import type { LDClient, LDStartOptions } from './LDClient';
import type { LDPlugin } from './LDPlugin';
import { makeClient } from './NodeClient';
import type { NodeIdentifyOptions } from './NodeIdentifyOptions';
import type { LDTLSOptions, NodeOptions } from './NodeOptions';

export * from './LDCommon';

/** @internal */
export { resetNodeStorage } from './platform/NodeStorage';

export type {
  NodeOptions as LDOptions,
  NodeIdentifyOptions as LDIdentifyOptions,
  LDClient,
  LDPlugin,
  LDStartOptions,
  LDTLSOptions,
};

export { basicLogger };

/**
 * Creates an instance of the LaunchDarkly client. Note that the client will not be ready to
 * use until {@link LDClient.start} is called.
 *
 * Usage:
 * ```
 * import { createClient } from '@launchdarkly/node-client-sdk';
 * const client = createClient(clientSideId, context, options);
 *
 * // Attach event listeners and add any additional logic here
 *
 * // Then start the client
 * client.start();
 * ```
 * @remarks
 * The client will not automatically start until {@link LDClient.start} is called in order to
 * synchronize the registering of event listeners and other initialization logic that should be
 * done before the client initiates its connection to LaunchDarkly.
 *
 * @param envKey
 *   The client-side ID, also known as the environment ID.
 * @param initialContext
 *   The initial context used to identify the user. @see {@link LDContext}
 * @param options
 *   Optional configuration settings. @see {@link LDOptions}
 * @returns
 *   The new client instance. @see {@link LDClient}
 */
export function createClient(
  envKey: string,
  initialContext: LDContext,
  options: NodeOptions = {},
): LDClient {
  return makeClient(envKey, initialContext, options);
}
