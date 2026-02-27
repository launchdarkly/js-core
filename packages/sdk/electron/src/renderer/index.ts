import { ElectronRendererClient } from './ElectronRendererClient';
import type { LDRendererClient } from './LDRendererClient';

export type { ConnectionMode } from '../LDCommon';

export type {
  LDContext,
  LDEvaluationDetail,
  LDEvaluationDetailTyped,
  LDFlagSet,
  LDFlagValue,
  LDIdentifyOptions,
} from '@launchdarkly/node-client-sdk';

export type { LDRendererClient };

export function createRendererClient(clientSideId: string, namespace?: string): LDRendererClient {
  return new ElectronRendererClient(clientSideId, namespace);
}
