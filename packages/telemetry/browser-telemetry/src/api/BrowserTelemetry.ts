import { LDClient, LDInspection } from 'launchdarkly-js-client-sdk';

import { Breadcrumb } from './Breadcrumb.js';

// TODO: Make a core client-side telemetry package.
// TODO: Put all the interfaces in the core package and only browser auto telemetry in the
// browser package.

export interface BrowserTelemetry {
  inspectors(): LDInspection[];

  captureError(exception: Error): void;
  captureErrorEvent(errorEvent: ErrorEvent): void;

  addBreadcrumb(breadcrumb: Breadcrumb): void;

  register(client: LDClient): void;

  close(): void;
}
