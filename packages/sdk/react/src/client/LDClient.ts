import React from 'react';

import {
  LDClient,
  LDContextStrict,
  LDEvaluationDetail,
  LDEvaluationDetailTyped,
  LDFlagValue,
  LDWaitForInitializationResult,
} from '@launchdarkly/js-client-sdk';

/**
 * Initialization state of the client. This type should be consistent with
 * the `status` field of the `LDWaitForInitializationResult` type.
 */
export type IntializedState = LDWaitForInitializationResult['status'] | 'initializing' | 'unknown';

/**
 * The LaunchDarkly client interface for React.
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
   * The LaunchDarkly context. This will be undefined if the client is not initialized.
   */
  context?: LDContextStrict;

  /**
   * The initialization state of the client.
   */
  intializedState: IntializedState;
}

/**
 * @experimental This interface is still under construction and is missing
 * some important functions.
 *
 * The LaunchDarkly client context provider interface for React.
 * This will be the type that is returned from our createContext function.
 */
export type LDReactClientContext = React.Context<LDReactClientContextValue>;
