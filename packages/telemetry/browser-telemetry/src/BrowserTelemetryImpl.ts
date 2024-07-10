import type {
  LDClient,
  LDContext,
  LDEvaluationDetail,
  LDInspection,
} from 'launchdarkly-js-client-sdk';

import { Breadcrumb, FeatureManagementBreadcrumb } from './api/Breadcrumb';
import { BrowserTelemetry } from './api/BrowserTelemetry';
import { Collector } from './api/Collector';
import { ErrorData } from './api/ErrorData';
import { EventData } from './api/EventData';
import ClickCollector from './collectors/click';
import ErrorCollector from './collectors/error';
import makeInspectors from './inspectors';
import { ParsedOptions } from './options';
import randomUuidV4 from './randomUuidV4';
import parse from './stack/StackParser';
import FetchCollector from './collectors/http/fetch';

// TODO: Add ring buffer instead of shifting.

const CUSTOM_KEY_PREFIX = '$ld:telemetry';
const ERROR_KEY = `${CUSTOM_KEY_PREFIX}:error`;
const SESSION_CAPTURE_KEY = `${CUSTOM_KEY_PREFIX}:sessionCapture`;

function safeValue(u: unknown): string | boolean | number | undefined {
  switch (typeof u) {
    case 'string':
    case 'boolean':
    case 'number':
      return u;
    default:
      return undefined;
  }
}

export default class BrowserTelemetryImpl implements BrowserTelemetry {
  private maxPendingEvents: number;
  private maxBreadcrumbs: number;

  private pendingEvents: { type: string; data: EventData }[] = [];
  private client?: LDClient;

  private breadcrumbs: Breadcrumb[] = [];

  private inspectorInstances: LDInspection[] = [];
  private collectors: Collector[] = [];
  private sessionId: string = randomUuidV4();

  constructor(options: ParsedOptions) {
    // Error collector is always required.
    this.collectors.push(new ErrorCollector());
    this.collectors.push(...options.collectors);
    this.collectors.push(new FetchCollector());
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
    this.pendingEvents.forEach((event) => {
      this.client?.track(event.type, event.data);
    });
  }

  inspectors(): LDInspection[] {
    return this.inspectorInstances;
  }

  private capture(type: string, event: EventData) {
    if (this.client === undefined) {
      this.pendingEvents.push({ type, data: event });
      if (this.pendingEvents.length > this.maxPendingEvents) {
        // TODO: Maybe log this?
        this.pendingEvents.shift();
      }
    }
    this.client?.track(`$ld:telemetry:${type}`, event);
  }

  captureError(exception: Error): void {
    const data: ErrorData = {
      type: exception.name || exception.constructor.name || 'generic',
      message: exception.message,
      stack: parse(exception),
      breadcrumbs: [...this.breadcrumbs],
      sessionId: this.sessionId,
    };
    this.capture(ERROR_KEY, data);
    this.dispatchError(exception);
  }

  captureErrorEvent(errorEvent: ErrorEvent): void {
    this.captureError(errorEvent.error);
  }

  captureSession(sessionEvent: EventData): void {
    this.capture(SESSION_CAPTURE_KEY, { ...sessionEvent, breadcrumbs: [...this.breadcrumbs] });
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

  handleFlagUsed(flagKey: string, detail: LDEvaluationDetail, context: LDContext): void {
    const breadcrumb: FeatureManagementBreadcrumb = {
      type: 'flag-evaluated',
      data: {
        key: flagKey,
        value: safeValue(detail.value),
      },
      timestamp: new Date().getTime(),
      class: 'feature-management',
      level: 'info',
    };
    this.addBreadcrumb(breadcrumb);

    this.dispatchFlagUsed(flagKey, detail, context);
  }

  handleFlagDetailChanged(flagKey: string, detail: LDEvaluationDetail): void {
    const breadcrumb: FeatureManagementBreadcrumb = {
      type: 'flag-detail-changed',
      data: {
        key: flagKey,
        value: safeValue(detail.value),
      },
      timestamp: new Date().getTime(),
      class: 'feature-management',
      level: 'info',
    };

    this.addBreadcrumb(breadcrumb);

    this.dispatchFlagDetailChanged(flagKey, detail);
  }

  private dispatchError(exception: Error) {
    this.collectors.forEach((collector) => {
      collector.handleErrorEvent?.(exception.name, exception.message);
    });
  }

  private dispatchFlagUsed(flagKey: string, flagDetail: LDEvaluationDetail, context: LDContext) {
    this.collectors.forEach((collector) => {
      collector.handleFlagUsed?.(flagKey, flagDetail, context);
    });
  }

  private dispatchFlagDetailChanged(flagKey: string, detail: LDEvaluationDetail) {
    this.collectors.forEach((collector) => {
      collector.handleFlagDetailChanged?.(flagKey, detail);
    });
  }
}
