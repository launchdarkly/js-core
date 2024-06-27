import type { LDContext, LDFlagSet, LDFlagValue } from '@launchdarkly/node-server-sdk';

import type { JSSdk } from './types';

/**
 * A partial ldClient suitable for RSC and server side rendering.
 */
export class LDClientRsc implements Partial<JSSdk> {
  constructor(
    private readonly ldContext: LDContext,
    private readonly bootstrap: LDFlagSet,
  ) {}

  allFlags(): LDFlagSet {
    return this.bootstrap;
  }

  getContext(): LDContext {
    return this.ldContext;
  }

  variation(key: string, defaultValue?: LDFlagValue): LDFlagValue {
    // On the server during ssr, call variation for analytics purposes.
    global?.nodeSdk?.variation(key, this.ldContext, defaultValue).then(/* ignore */);
    return this.bootstrap[key] ?? defaultValue;
  }
}
