import { type LDInspection } from 'launchdarkly-js-client-sdk';
// eslint-disable-next-line import/no-extraneous-dependencies
import { type LDContext, type LDEvaluationDetail } from 'launchdarkly-js-sdk-common';

import BrowserTelemetryImpl from './BrowserTelemetryImpl.js';
import { ParsedOptions } from './options.js';

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
      method(flagKey: string, flagDetail: LDEvaluationDetail, context: LDContext): void {
        telemetry.handleFlagUsed(flagKey, flagDetail, context);
      },
    });
  }

  if (options.breadcrumbs.flagChange) {
    inspectors.push({
      type: 'flag-detail-changed',
      name: 'launchdarkly-browser-telemetry-flag-used',
      synchronous: true,
      method(flagKey: string, detail: LDEvaluationDetail): void {
        telemetry.handleFlagDetailChanged(flagKey, detail);
      },
    });
  }
}
