import type { LDClient as NodeSdk } from '@launchdarkly/node-server-sdk';

export type { LDClient as JSSdk } from '@launchdarkly/js-client-sdk';

export type { NodeSdk };

declare global {
  module globalThis {
    // eslint-disable-next-line vars-on-top, no-var
    var nodeSdk: NodeSdk;
  }
}
