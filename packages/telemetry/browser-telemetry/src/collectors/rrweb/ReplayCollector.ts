import type { LDContext, LDEvaluationDetail } from '@launchdarkly/js-client-sdk';

/**
 * For session replay there is a need to annotate the session data with 
 */
export interface SessionMetadata {
  handleFlagUsed?(flagKey: string, flagDetail: LDEvaluationDetail, _context: LDContext): void;
  handleFlagDetailChanged?(flagKey: string, detail: LDEvaluationDetail): void;
  handleErrorEvent(name: string, message: string): void;
}
