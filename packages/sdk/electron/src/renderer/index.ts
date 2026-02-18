import { ElectronRendererClient } from './ElectronRendererClient';
import type { LDRendererClient } from './LDRendererClient';

export type {
  ConnectionMode,
  LDContext,
  LDEvaluationDetail,
  LDEvaluationDetailTyped,
  LDFlagSet,
  LDFlagValue,
  LDIdentifyOptions,
} from '@launchdarkly/js-client-sdk-common';

export type { LDRendererClient };

export function createRendererClient(clientSideId: string): LDRendererClient {
  return new ElectronRendererClient(clientSideId);
}
