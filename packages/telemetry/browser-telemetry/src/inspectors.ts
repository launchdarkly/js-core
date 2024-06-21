import { LDInspection } from 'launchdarkly-js-client-sdk';
// eslint-disable-next-line import/no-extraneous-dependencies
import { LDContext, LDEvaluationDetail } from 'launchdarkly-js-sdk-common';

import { BrowserTelemetry } from './api/BrowserTelemetry.js';
import { ParsedOptions } from './options.js';

export default function makeInspectors(
  options: ParsedOptions,
  inspectors: LDInspection[],
  telemetry: BrowserTelemetry,
) {
  if (options.breadcrumbs.evaluations) {
    inspectors.push({
      type: 'flag-used',
      name: 'launchdarkly-browser-telemetry-flag-used',
      synchronous: true,
      method(flagKey: string, flagDetail: LDEvaluationDetail, _context: LDContext): void {
        // TODO: Finalize shape.
        telemetry.addBreadcrumb({
          type: 'flag-evaluated',
          flagKey,
          value: flagDetail.value,
          timestamp: new Date().getTime(),
        });
      },
    });
  }

  if (options.breadcrumbs.flagChange) {
    inspectors.push({
      type: 'flag-detail-changed',
      name: 'launchdarkly-browser-telemetry-flag-used',
      synchronous: true,
      method(flagKey: string, detail: LDEvaluationDetail): void {
        telemetry.addBreadcrumb({
          type: 'flag-detail-changed',
          flagKey,
          detail,
        });
      },
    });
  }
}
