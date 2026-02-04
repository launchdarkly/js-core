'use client';

import { createContext } from "react";
import type { LDReactClientContext, LDReactClientContextValue } from "../LDClient";

// initializes a new context for the LaunchDarkly client. The sole usage of this function
// is to create a new context so that it could be referenced and managed by the
// application. This is a common pattern in React to create a new context for a
// specific purpose.
export function initLDReactContext(): LDReactClientContext {
  return createContext<LDReactClientContextValue>(null as any);
}

export const LDReactContext: LDReactClientContext = initLDReactContext();
