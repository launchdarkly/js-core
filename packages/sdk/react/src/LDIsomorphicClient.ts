import { LDClient } from '@launchdarkly/js-client-sdk-common';
import { LDReactServerClient } from './server/LDClient';
import { LDReactClient } from './client/LDClient';

/**
 * The LaunchDarkly isomorphic client interface.
 * 
 * This is a common interface that can be used to create a client
 * that can be used on the server and client sides.
 * 
 * @privateRemarks
 * NOTE: This interface might be replaced shared functions in the future which
 * maybe better for tree shaking.
 * 
 * @see {@link LDReactClient} for the client side implementation
 * @see {@link LDReactServerClient} for the server side implementation
 *
 */
export interface LDIsomorphicClient extends Omit<LDClient, 'waitForInitialization' | 'start' | 'addHook'> {
  /**
   * useServerClient is used to create a server side client.
   * 
   * @returns The server side client.
   */
  useServerClient: () => LDReactServerClient;

  /**
   * useBrowserClient is used to create a browser side client.
   * 
   * @returns The browser side client.
   */
  useBrowserClient: () => LDReactClient;
}