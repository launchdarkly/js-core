import { ElectronLDRendererClientCompat } from './ElectronLDRendererClientCompat';
import type { LDFlagChangeset, LDRendererClientCompat } from './LDRendererClientCompat';

export type {
  Hook,
  LDContext,
  LDEvaluationDetail,
  LDFlagSet,
  LDFlagValue,
} from '@launchdarkly/js-client-sdk-common';

export type { LDFlagChangeset, LDRendererClientCompat };

export function initInRenderer(clientSideId: string): LDRendererClientCompat {
  return new ElectronLDRendererClientCompat(clientSideId);
}
