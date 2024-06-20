import { LDClient, LDInspection } from 'launchdarkly-js-client-sdk';

import { Breadcrumb } from './api/Breadcrumb';
import { BrowserTelemetry } from './api/BrowserTelemetry';
import { Collector } from './api/Collector';
import { Event } from './api/Event';
import { ParsedOptions } from './options';
import ClickCollector from './collectors/click';
import { makeInspectors } from './inspectors';
import ErrorCollector from './collectors/error';

// TODO: Add ring buffer instead of shifting.

export default class BrowserTelemetryImpl implements BrowserTelemetry {
  private maxPendingEvents: number;
  private maxBreadcrumbs: number;

  private pendingEvents: Event[] = [];
  private client?: LDClient;

  private breadcrumbs: Breadcrumb[] = [];

  private inspectorInstances: LDInspection[] = [];
  private collectors: Collector[] = [];

  constructor(options: ParsedOptions) {
    // Error collector is always required.
    this.collectors.push(new ErrorCollector());
    this.collectors.push(...options.collectors);
    this.maxPendingEvents = options.maxPendingEvents;
    this.maxBreadcrumbs = options.breadcrumbs.maxBreadcrumbs;

    if (options.breadcrumbs.click) {
      this.collectors.push(new ClickCollector());
    }

    this.collectors.forEach((collector) => collector.register(this as BrowserTelemetry));

    const impl = this;
    const inspectors: LDInspection[] = []
    makeInspectors(options, inspectors, impl);
    this.inspectorInstances.push(...inspectors);
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
    this.client?.track('$ld:telemetry', event);
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

  addBreadcrumb(breadcrumb: Breadcrumb): void {
    this.breadcrumbs.push(breadcrumb);
    if (this.breadcrumbs.length > this.maxBreadcrumbs) {
      this.breadcrumbs.shift();
    }
  }

  close(): void {
    this.collectors.forEach(collector => collector.unregister());
  }
}
