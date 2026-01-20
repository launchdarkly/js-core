import { ElectronLDRendererClient } from './ElectronLDRendererClient';
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

export function initInRenderer(clientSideId: string): LDRendererClient {
  return new ElectronLDRendererClient(clientSideId);
}
