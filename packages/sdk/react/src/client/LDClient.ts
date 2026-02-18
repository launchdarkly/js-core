import { LDClient, LDContext, LDWaitForInitializationResult } from '@launchdarkly/js-client-sdk';

/**
 * The LaunchDarkly client interface for React.
 *
 * @privateRemarks
 * We will provide 2 ways to create instances of LDClient:
 * 1. A `createClient` function that is similar to the js-client-sdk's `createClient` function.
 * 2. A `createLDProvider` function that creates a React Context
 *
 */
export interface LDReactClient extends LDClient {
  /**
   * Returns the initialization state of the client. This function is helpful to determine
   * whether LDClient can be used to evaluate flags on intial component render.
   *
   * @see {@link LDWaitForInitializationResult} for the possible values and their meaning
   *
   * @returns {Promise<LDWaitForInitializationResult>} The initialization state of the client.
   */
  getInitializationState(): Promise<LDWaitForInitializationResult>;
}

/**
 * The react context interface for the launchdarkly client. This will be the type that is
 * used in the `createContext` function.
 */
export interface LDReactClientContext {
  /**
   * The LaunchDarkly client.
   */
  client: LDReactClient;

  /**
   * The LaunchDarkly context.
   */
  context: LDContext;

  /**
   * The initialization state of the client.
   */
  intializedState: LDWaitForInitializationResult;
}
