import type { LDContext, LDEvaluationDetail, LDInspection } from '@launchdarkly/js-client-sdk';

import BrowserTelemetryImpl from './BrowserTelemetryImpl.js';
import { ParsedOptions } from './options.js';

/**
 * Create inspectors to register with an LDClient instance.
 *
 * @param options Optiont which determine which inspectors are created.
 * @param inspectors Inspectors will be added to this array.
 * @param telemetry The telemetry instance which inspectors will forward data to.
 */
export default function makeInspectors(
  options: ParsedOptions,
  inspectors: LDInspection[],
  telemetry: BrowserTelemetryImpl,
) {
  if (options.breadcrumbs.evaluations) {
    inspectors.push({
      type: 'flag-used',
      name: 'launchdarkly-browser-telemetry-flag-used',
      synchronous: true,
      method(flagKey: string, flagDetail: LDEvaluationDetail, context?: LDContext): void {
        telemetry.handleFlagUsed(flagKey, flagDetail, context);
      },
    });
  }

  if (options.breadcrumbs.flagChange) {
    inspectors.push({
      type: 'flag-detail-changed',
      name: 'launchdarkly-browser-telemetry-flag-detail-changed',
      synchronous: true,
      method(flagKey: string, detail: LDEvaluationDetail): void {
        telemetry.handleFlagDetailChanged(flagKey, detail);
      },
    });
    inspectors.push({
      type: 'flag-details-changed',
      name: 'launchdarkly-browser-telemetry-flag-details-changed',
      synchronous: true,
      method(details: Record<string, LDEvaluationDetail>) {
        Object.entries(details).forEach(([key, detail]) => {
          telemetry.handleFlagDetailChanged(key, detail);
        });
      },
    });
  }
}
