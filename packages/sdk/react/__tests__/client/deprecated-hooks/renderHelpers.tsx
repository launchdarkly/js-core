import React from 'react';

import { LDReactClientContextValue } from '../../../src/client/LDClient';
import { LDReactContext } from '../../../src/client/provider/LDReactContext';
import { makeMockClient } from '../mockClient';

export function makeWrapper(mockClient: ReturnType<typeof makeMockClient>) {
  const contextValue: LDReactClientContextValue = {
    client: mockClient,
    initializedState: 'unknown',
  };

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <LDReactContext.Provider value={contextValue}>{children}</LDReactContext.Provider>;
  };
}

/**
 * Creates a wrapper whose context value can be updated after render.
 * `setterRef.current` is set on first render and can be called inside `act()`.
 */
export function makeStatefulWrapper(mockClient: ReturnType<typeof makeMockClient>) {
  const setterRef = {
    current: null as React.Dispatch<React.SetStateAction<LDReactClientContextValue>> | null,
  };

  function Wrapper({ children }: { children: React.ReactNode }) {
    const [ctxValue, setCtx] = React.useState<LDReactClientContextValue>({
      client: mockClient,
      initializedState: 'complete',
    });
    setterRef.current = setCtx;
    return <LDReactContext.Provider value={ctxValue}>{children}</LDReactContext.Provider>;
  }

  return { Wrapper, setterRef };
}
