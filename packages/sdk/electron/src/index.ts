import { ElectronLDMainClient } from './ElectronLDMainClient';
import type { ElectronOptions as LDOptions, LDProxyOptions, LDTLSOptions } from './ElectronOptions';
import type { LDClient } from './LDClient';
import type { LDPlugin } from './LDPlugin';

export * from '@launchdarkly/js-client-sdk-common';

export type { LDOptions, LDClient, LDPlugin, LDProxyOptions, LDTLSOptions };

export function initInMain(clientSideId: string, options: LDOptions = {}): LDClient {
  return new ElectronLDMainClient(clientSideId, options);
}
