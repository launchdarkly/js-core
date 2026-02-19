import { LDClient, LDContext, LDWaitForInitializationResult } from '@launchdarkly/js-client-sdk';

/**
 * Initialization state of the client. This type should be consistent with 
 * the `status` field of the `LDWaitForInitializationResult` type.
 */
export type IntializedState = LDWaitForInitializationResult['status'] | 'initializing' | 'unknown';

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
   * @returns {IntializedState} The initialization state of the client.
   */
  getInitializationState(): IntializedState;
}

/**
 * The react context interface for the launchdarkly client. This will be the type that is
 * used in the `createContext` function.
 */
export interface LDReactClientContextValue {
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
  intializedState: IntializedState;
}

/**
 * The LaunchDarkly client context provider interface for React.
 * This will be the type that is returned from our createContext function.
 */
export interface LDReactClientContextProvider {
  Context: React.Context<LDReactClientContextValue>;
}

