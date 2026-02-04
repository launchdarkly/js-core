import { LDReactClient } from './client/LDClient';
import { LDReactServerClient } from './server/LDClient';

/**
 * The LaunchDarkly isomorphic client interface.
 *
 * This is a common interface that can be used to create a client
 * that can be used on the server and client sides.
 *
 * @privateRemarks
 * NOTE: This interface might be replaced shared functions in the future which
 * maybe better for tree shaking.
 */
export interface LDIsomorphicClient extends Omit<
  LDReactClient,
  'waitForInitialization' | 'start' | 'addHook'
> {

  /**
   * A builder function that will federate the current client with a server component.
   * RSC components will ONLY be available if this function is called.
   *
   * @remarks
   * By default, the react client will only be doing client side rendering.
   *
   * @param LDServerClient A LaunchDarkly server client
   * @returns 
   */
  useServerClient: (LDServerClient: LDReactServerClient) => this;
}
