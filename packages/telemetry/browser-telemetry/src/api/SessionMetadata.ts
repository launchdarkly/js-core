import type { LDContext, LDEvaluationDetail } from '@launchdarkly/js-client-sdk';

/**
 * In some cases collectors may need additional runtime information about feature management
 * and errors. This may be used to annotate other events, or insert events into a stream.
 *
 * For example session replay data may include markers for when a flag is used or when an error
 * happened.
 */
export interface SessionMetadata {
  handleFlagUsed?(flagKey: string, flagDetail: LDEvaluationDetail, context?: LDContext): void;
  handleFlagDetailChanged?(flagKey: string, detail: LDEvaluationDetail): void;
  handleErrorEvent(name: string, message: string): void;
}
