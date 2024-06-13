import { LDClient, LDInspection } from 'launchdarkly-js-client-sdk';
import { LDContext, LDEvaluationDetail } from 'launchdarkly-js-sdk-common';

import { Breadcrumb } from './api/Breadcrumb.js';
import { BrowserTelemetry } from './api/BrowserTelemetry.js';
import { Collector } from './api/Collector.js';
import { Event } from './api/Event.js';

export default class BrowserTelemetryImpl implements BrowserTelemetry {
  // TODO: Add this to a configuration.
  private maxPendingEvents = 100;
  private numBreadCrumbs = 5;

  private pendingEvents: Event[] = [];
  private client?: LDClient;

  private breadcrumbs: Breadcrumb[] = [];

  private inspectorInstances: LDInspection[] = [];

  constructor(private collectors: Collector[]) {
    collectors.forEach((collector) => collector.register(this as BrowserTelemetry));

    const impl = this;
    this.inspectorInstances.push({
      type: 'flag-used',
      name: 'browser-telemetry-flag-used',
      method(flagKey: string, flagDetail: LDEvaluationDetail, _context: LDContext): void {
        // TODO: Finalize shape.
        impl.addBreadcrumb({
          type: 'flag-evaluated',
          flagKey,
          value: flagDetail.value,
          timestamp: new Date().getTime(),
        });
      },
    });
  }

  register(client: LDClient): void {
    this.client = client;
  }

  inspectors(): LDInspection[] {
    return this.inspectorInstances;
  }

  private capture(event: Event) {
    if (this.client === undefined) {
      this.pendingEvents.push(event);
      if (this.pendingEvents.length > this.maxPendingEvents) {
        // TODO: Maybe log this?
        this.pendingEvents.shift();
      }
    }
    this.client?.track('telemetry', event);
  }

  captureError(exception: Error): void {
    this.capture({
      type: 'exception',
      message: exception.message,
      name: exception.name,
      stack: exception.stack, // TODO: Do we need to locally process the stack.
      breadcrumbs: [...this.breadcrumbs],
    });
  }
  captureErrorEvent(errorEvent: ErrorEvent): void {
    // TODO: More details?
    this.captureError(errorEvent.error);
  }

  addContext(): void {
    throw new Error('Method not implemented.');
  }

  addBreadcrumb(breadcrumb: Breadcrumb): void {
    this.breadcrumbs.push(breadcrumb);
    if (this.breadcrumbs.length > this.numBreadCrumbs) {
      this.breadcrumbs.shift();
    }
  }
}
