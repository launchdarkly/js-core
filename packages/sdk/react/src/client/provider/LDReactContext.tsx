'use client';

import { createContext, useContext } from 'react';

import { LDReactClientContext, LDReactClientContextValue } from '../LDClient';

/**
 * Initializes a new context for the LaunchDarkly client. The sole usage of this function
 * is to create a new context so that it could be referenced and managed by the
 * application. This is a common pattern in React to create a new context for a
 * specific purpose.
 *
 * @returns {LDReactClientContext} The LaunchDarkly client context.
 * @see {@link LDReactClientContext} for the possible values and their meaning
 */
export function initLDReactContext(): LDReactClientContext {
  const context = createContext<LDReactClientContextValue>(null as any);
  return {
    context,
    useLDClient: () => {
      const { client } = useContext(context);
      return client;
    },
  };
}
