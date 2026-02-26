import React from 'react';

import {
  LDClient,
  LDContextStrict,
  LDWaitForInitializationResult,
} from '@launchdarkly/js-client-sdk';

/**
 * Initialization state of the client. This type should be consistent with
 * the `status` field of the `LDWaitForInitializationResult` type.
 */
export type InitializedState = LDWaitForInitializationResult['status'] | 'initializing' | 'unknown';

/**
 * The LaunchDarkly client interface for React.
 */
export interface LDReactClient extends LDClient {
  /**
   * Returns the initialization state of the client. This function is helpful to determine
   * whether LDClient can be used to evaluate flags on initial component render.
   *
   * @see {@link LDWaitForInitializationResult} for the possible values and their meaning
   *
   * @returns {InitializedState} The initialization state of the client.
   */
  getInitializationState(): InitializedState;

  /**
   * Subscribes to context changes triggered by `identify()`. The callback is invoked
   * after each successful `identify()` call with the new resolved context.
   *
   * @param callback Function called with the new context after each successful identify.
   * @returns An unsubscribe function. Call it to stop receiving notifications.
   */
  onContextChange(callback: (context: LDContextStrict) => void): () => void;
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
   * The LaunchDarkly context. This will be undefined if the client is not initialized.
   */
  context?: LDContextStrict;

  /**
   * The initialization state of the client.
   */
  initializedState: InitializedState;
}

/**
 * @experimental This interface is still under construction and is missing
 * some important functions.
 *
 * The LaunchDarkly client context provider interface for React.
 * This will be the type that is returned from our createContext function.
 */
export type LDReactClientContext = React.Context<LDReactClientContextValue>;
