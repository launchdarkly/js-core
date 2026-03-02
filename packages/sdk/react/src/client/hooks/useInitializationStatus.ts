'use client';

import { useContext } from 'react';

import type { LDReactClientContextValue } from '../LDClient';
import { LDReactContext } from '../provider/LDReactContext';

/**
 * The result of `useInitializationStatus`. Represents the current initialization
 * state of the LaunchDarkly client.
 *
 * @remarks
 * This replaces `useLDClientError` from `launchdarkly-react-client-sdk`. It provides
 * richer information: both the initialization state and the error (if any).
 *
 * Use `useInitializationStatus().error` to access the error,
 * and `useInitializationStatus().status` to determine the full state.
 */
export type InitializationStatus =
  | { status: 'unknown' }
  | { status: 'initializing' }
  | { status: 'complete' }
  | { status: 'timeout' }
  | { status: 'failed'; error: Error };

/**
 * Returns the initialization status of the LaunchDarkly client.
 *
 * @privateRemarks
 * This hooks is not completed yet. Right now it will work because context updates will cause a re-evaluation
 * of the initialization status. However, I think we should still add a way to subscribe to initialization status changes.
 * This could cause some marginal performance overhead, but state updates should be batched so should not be a problem.
 * Any feedback on this is welcome.
 *
 * @param reactContext Optional React context to read from. Defaults to the global `LDReactContext`.
 * @returns An {@link InitializationStatus} object with the current state (and error, if failed).
 */
export function useInitializationStatus(
  reactContext?: React.Context<LDReactClientContextValue>,
): InitializationStatus {
  const { initializedState, error } = useContext(reactContext ?? LDReactContext);
  if (initializedState === 'failed') {
    return { status: 'failed', error: error! };
  }
  return { status: initializedState };
}
