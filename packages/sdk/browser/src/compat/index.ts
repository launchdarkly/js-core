/**
 * This module provides a compatibility layer which emulates the interface used
 * in the launchdarkly-js-client 3.x package.
 *
 * Some code changes may still be required, for example {@link LDOptions} removes
 * support for some previously available options.
 */
import { LDContext, LDOptions } from '..';
import { LDClient } from './LDClientCompat';
import LDClientCompatImpl from './LDClientCompatImpl';

/**
 * Creates an instance of the LaunchDarkly client. This version of initialization is for
 * improved backwards compatibility. In general the `initialize` function from the root packge
 * should be used instead of the one in the `/compat` module.
 *
 * The client will begin attempting to connect to LaunchDarkly as soon as it is created. To
 * determine when it is ready to use, call {@link LDClient.waitForInitialization}, or register an
 * event listener for the `"ready"` event using {@link LDClient.on}.
 *
 * Example:
 *     import { initialize } from '@launchdarkly/js-client-sdk/compat';
 *     const client = initialize(envKey, context, options);
 *
 * Note: The `compat` module minimizes compatibility breaks, but not all functionality is directly
 * equivalent to the previous version.
 *
 * LDOptions are where the primary differences are. By default the new SDK implementation will
 * generally use localStorage to cache flags. This can be disabled by setting the
 * `maxCachedContexts` to 0.
 *
 * This does allow combinations that were not possible before. For insance an initial context
 * could be identified using bootstrap, and a second context without bootstrap, and the second
 * context could cache flags in local storage. For more control the primary module can be used
 * instead of this `compat` module (for instance bootstrap can be provided per identify call in
 * the primary module).
 *
 * @param envKey
 *   The environment ID.
 * @param context
 *   The initial context properties. These can be changed later with {@link LDClient.identify}.
 * @param options
 *   Optional configuration settings.
 * @return
 *   The new client instance.
 */
export function initialize(envKey: string, context: LDContext, options?: LDOptions): LDClient {
  return new LDClientCompatImpl(envKey, context, options);
}
