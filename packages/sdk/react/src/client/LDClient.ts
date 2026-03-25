import React from 'react';

import {
  LDClient,
  LDContextStrict,
  LDWaitForInitializationResult,
} from '@launchdarkly/js-client-sdk';

/**
 * Represents the current initialization state of the LaunchDarkly client.
 */
export type InitializationStatus = LDWaitForInitializationResult | { status: 'initializing' };

/**
 * Initialization state of the client as a string union.
 * Derived from {@link InitializationStatus} for consistency.
 */
export type InitializedState = InitializationStatus['status'];

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
   * Returns the error that caused initialization to fail, if any.
   * Only set when `getInitializationState()` returns `'failed'`.
   */
  getInitializationError(): Error | undefined;

  /**
   * Subscribes to context changes triggered by `identify()`. The callback is invoked
   * after each successful `identify()` call with the new resolved context.
   *
   * @param callback Function called with the new context after each successful identify.
   * @returns An unsubscribe function. Call it to stop receiving notifications.
   */
  onContextChange(callback: (context: LDContextStrict) => void): () => void;

  /**
   * Subscribes to initialization status changes triggered when the client is initialized.
   *
   * @param callback Function called with the initialization result.
   * @returns An unsubscribe function. Call it to stop receiving notifications.
   */
  onInitializationStatusChange(
    callback: (result: LDWaitForInitializationResult) => void,
  ): () => void;

  /**
   * @internal
   *
   * Returns whether flag keys should be converted to camelCase in `useFlags()` and resolved from camelCase
   * in the individual variation hooks. Defaults to `true` when absent.
   *
   * @remarks
   * **NOTE:** This method is only used by `useFlags()` hook.
   *
   * @deprecated This method is deprecated and will be removed in a future major version.
   *
   * @returns {boolean} Whether flag keys should be converted to camelCase.
   */
  shouldUseCamelCaseFlagKeys(): boolean;
}

/**
 * The React context interface for the LaunchDarkly client.
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

  /**
   * The error that caused the client to fail to initialize. Only set when `initializedState` is `'failed'`.
   */
  error?: Error;
}

/**
 * The LaunchDarkly client context provider interface for React.
 * This will be the type that is returned from our createContext function.
 */
export type LDReactClientContext = React.Context<LDReactClientContextValue>;
