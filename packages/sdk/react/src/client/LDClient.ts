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
 * This interface will contain the react context created by `createContext` function
 * as well as scoped react hooks.
 */
export interface LDReactClientContext {
  context: React.Context<LDReactClientContextValue>;

  /**
   * NOTE: I am keeping everything below this line as a reference for future implementation
   * so they will all be optional for now. Hopefully this can help us articulate what we are
   * planning to do with this.
   *
   * This is also not the final list of hooks that we will be providing.
   */
  useLDClient?: () => LDReactClient | undefined;
  useVariation?: (key: string, defaultValue: LDFlagValue) => LDFlagValue | undefined;
  useVariationDetail?: (key: string, defaultValue: LDFlagValue) => LDEvaluationDetail | undefined;
  useBoolVariation?: (key: string, defaultValue: boolean) => boolean | undefined;
  useBoolVariationDetail?: (
    key: string,
    defaultValue: boolean,
  ) => LDEvaluationDetailTyped<boolean> | undefined;
  useNumberVariation?: (key: string, defaultValue: number) => number | undefined;
  useNumberVariationDetail?: (
    key: string,
    defaultValue: number,
  ) => LDEvaluationDetailTyped<number> | undefined;
  useStringVariation?: (key: string, defaultValue: string) => string | undefined;
  useStringVariationDetail?: (
    key: string,
    defaultValue: string,
  ) => LDEvaluationDetailTyped<string> | undefined;
  useJsonVariation?: (key: string, defaultValue: unknown) => unknown | undefined;
  useJsonVariationDetail?: (
    key: string,
    defaultValue: unknown,
  ) => LDEvaluationDetailTyped<unknown> | undefined;
}
