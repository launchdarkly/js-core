'use client';

import { createContext } from 'react';

import type { LDReactClientContext, LDReactClientContextValue } from '../LDClient';

/**
 * Creates a new LaunchDarkly React context.
 *
 * @remarks
 * This function can be used to create different LaunchDarkly contexts for the same
 * application.
 *
 * **NOTE:** This function is not necessary if you are only using a single LaunchDarkly environment.
 * If that is the case, you can use the {@link LDReactContext} directly.
 *
 * @returns A new React context for the LaunchDarkly client.
 */
export function initLDReactContext(): LDReactClientContext {
  return createContext<LDReactClientContextValue>(null as any);
}

/**
 * The default LaunchDarkly React context.
 *
 * @example
 * ```tsx
 * import { LDReactContext, useLDClient } from '@launchdarkly/react-sdk';
 *
 * function MyComponent() {
 *   const client = useLDClient(LDReactContext);
 *   const flagValue = client.boolVariation('my-flag', false);
 *   return <div>{flagValue ? 'on' : 'off'}</div>;
 * }
 * ```
 */
export const LDReactContext: LDReactClientContext = initLDReactContext();
