/**
 * This is the API reference for the LaunchDarkly Client-Side SDK for JavaScript.
 *
 * This SDK is intended for use in browser environments.
 *
 * In typical usage, you will call {@link initialize} once at startup time to obtain an instance of
 * {@link LDClient}, which provides access to all of the SDK's functionality.
 *
 * For more information, see the [SDK Reference Guide](https://docs.launchdarkly.com/sdk/client-side/javascript).
 *
 * @packageDocumentation
 */
import { AutoEnvAttributes } from '@launchdarkly/js-client-sdk-common';

import { makeClient } from './BrowserClient';
import { LDClient } from './LDClient';
import { BrowserOptions as LDOptions } from './options';

export * from './common';
export type { LDClient, LDOptions };
export type { LDPlugin } from './LDPlugin';

/**
 * Creates an instance of the LaunchDarkly client.
 *
 * Usage:
 * ```
 * import { initialize } from 'launchdarkly-js-client-sdk';
 * const client = initialize(clientSideId, options);
 * ```
 *
 * @param clientSideId
 *   The client-side ID, also known as the environment ID.
 * @param options
 *   Optional configuration settings.
 * @return
 *   The new client instance.
 */
export function initialize(clientSideId: string, options?: LDOptions): LDClient {
  // AutoEnvAttributes are not supported yet in the browser SDK.
  return makeClient(clientSideId, AutoEnvAttributes.Disabled, options);
}
