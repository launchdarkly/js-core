import {
  type LDClient,
  type LDContext,
  type LDEvaluationDetail,
  type LDInspection,
} from 'launchdarkly-js-client-sdk';

import { Breadcrumb } from './api/Breadcrumb';
import { BrowserTelemetry } from './api/BrowserTelemetry';
import { Collector } from './api/Collector';
import { Event } from './api/Event';
import ClickCollector from './collectors/click';
import ErrorCollector from './collectors/error';
import makeInspectors from './inspectors';
import { ParsedOptions } from './options';

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
    const inspectors: LDInspection[] = [];
    makeInspectors(options, inspectors, impl);
    this.inspectorInstances.push(...inspectors);
  }

  register(client: LDClient): void {
    this.client = client;
  }

  inspectors(): LDInspection[] {
    return this.inspectorInstances;
  }

  private capture(event: Event, type: string) {
    if (this.client === undefined) {
      this.pendingEvents.push(event);
      if (this.pendingEvents.length > this.maxPendingEvents) {
        // TODO: Maybe log this?
        this.pendingEvents.shift();
      }
    }
    this.client?.track(`$ld:telemetry:${type}`, event);
  }

  captureError(exception: Error): void {
    this.capture(
      {
        message: exception.message,
        name: exception.name,
        stack: exception.stack, // TODO: Do we need to locally process the stack.
        breadcrumbs: [...this.breadcrumbs],
      },
      'error',
    );
    this.dispatchError(exception);
  }

  captureErrorEvent(errorEvent: ErrorEvent): void {
    // TODO: More details?
    this.captureError(errorEvent.error);
  }

  captureSession(sessionEvent: Event): void {
    this.capture({ ...sessionEvent, breadcrumbs: [...this.breadcrumbs] }, 'sessionCapture');
  }

  addBreadcrumb(breadcrumb: Breadcrumb): void {
    this.breadcrumbs.push(breadcrumb);
    if (this.breadcrumbs.length > this.maxBreadcrumbs) {
      this.breadcrumbs.shift();
    }
  }

  close(): void {
    this.collectors.forEach((collector) => collector.unregister());
  }

  handleFlagUsed(flagKey: string, flagDetail: LDEvaluationDetail, context: LDContext): void {
    this.addBreadcrumb({
      type: 'flag-evaluated',
      flagKey,
      value: flagDetail.value,
      timestamp: new Date().getTime(),
    });

    this.dispatchFlagUsed(flagKey, flagDetail, context);
  }

  handleFlagDetailChanged(flagKey: string, detail: LDEvaluationDetail): void {
    this.addBreadcrumb({
      type: 'flag-detail-changed',
      flagKey,
      detail,
    });

    this.dispatchFlagDetailChanged(flagKey, detail);
  }

  private dispatchError(exception: Error) {
    this.collectors.forEach((collector) => {
      if (collector.handleErrorEvent) {
        collector.handleErrorEvent(exception.name, exception.message);
      }
    });
  }

  private dispatchFlagUsed(flagKey: string, flagDetail: LDEvaluationDetail, context: LDContext) {
    this.collectors.forEach((collector) => {
      if (collector.handleFlagUsed) {
        collector.handleFlagUsed(flagKey, flagDetail, context);
      }
    });
  }

  private dispatchFlagDetailChanged(flagKey: string, detail: LDEvaluationDetail) {
    this.collectors.forEach((collector) => {
      if (collector.handleFlagDetailChanged) {
        collector.handleFlagDetailChanged(flagKey, detail);
      }
    });
  }
}
