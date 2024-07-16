import { type LDContext, type LDEvaluationDetail } from 'launchdarkly-js-client-sdk';

import { BrowserTelemetry } from './BrowserTelemetry';

export interface Collector {
  register(telemetry: BrowserTelemetry, sessionId: string): void;
  unregister(): void;

  handleFlagUsed?(flagKey: string, flagDetail: LDEvaluationDetail, _context: LDContext): void;
  handleFlagDetailChanged?(flagKey: string, detail: LDEvaluationDetail): void;
  // TODO: Should have an ID to correlate to.
  handleErrorEvent?(name: string, message: string): void;
}
