import type { ConnectionMode, LDClient as LDClientBase } from '@launchdarkly/js-client-sdk-common';

export interface LDClient extends LDClientBase {
  setConnectionMode(mode: ConnectionMode): Promise<void>;

  getConnectionMode(): ConnectionMode;

  isOffline(): boolean;
}
