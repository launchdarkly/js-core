/**
 * This is the API reference for the LaunchDarkly Client-Side SDK for JavaScript.
 *
 * This SDK is intended for use in browser environments.
 *
 * In typical usage, you will call {@link createClient} once at startup time to obtain an instance of
 * {@link LDClient}, which provides access to all of the SDK's functionality.
 *
 * For more information, see the [SDK Reference Guide](https://docs.launchdarkly.com/sdk/client-side/javascript).
 *
 * @packageDocumentation
 */
import { AutoEnvAttributes, LDContextWithAnonymous } from '@launchdarkly/js-client-sdk-common';

import { makeClient } from './BrowserClient';
import { LDClient } from './LDClient';
import { BrowserOptions as LDOptions } from './options';

export * from './common';
export type { LDClient, LDOptions };
export type { LDPlugin } from './LDPlugin';

/**
 * Creates an instance of the LaunchDarkly client. Note that the client will not be ready to
 * use until {@link LDClient.start} is called.
 *
 * Usage:
 * ```
 * import { createClient } from 'launchdarkly-js-client-sdk';
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
 * @param clientSideId
 *   The client-side ID, also known as the environment ID.
 * @param pristineContext
 *   The initial context used to identify the user. @see {@link LDContext}
 * @param options
 *   Optional configuration settings. @see {@link LDOptions}
 * @returns
 *   The new client instance. @see {@link LDClient}
 */
export function createClient(
  clientSideId: string,
  pristineContext: LDContextWithAnonymous,
  options?: LDOptions,
): LDClient {
  // AutoEnvAttributes are not supported yet in the browser SDK.
  const client = makeClient(clientSideId, pristineContext, AutoEnvAttributes.Disabled, options);

  return client;
}
