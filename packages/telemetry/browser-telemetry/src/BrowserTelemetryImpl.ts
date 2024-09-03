import type {
  LDClient,
  LDContext,
  LDEvaluationDetail,
  LDInspection,
} from 'launchdarkly-js-client-sdk';
import TraceKit from 'tracekit';

import { Breadcrumb, FeatureManagementBreadcrumb } from './api/Breadcrumb';
import { BrowserTelemetry } from './api/BrowserTelemetry';
import { Collector } from './api/Collector';
import { ErrorData } from './api/ErrorData';
import { EventData } from './api/EventData';
import ClickCollector from './collectors/dom/ClickCollector';
import KeypressCollector from './collectors/dom/KeypressCollector';
import ErrorCollector from './collectors/error';
import FetchCollector from './collectors/http/fetch';
import XhrCollector from './collectors/http/xhr';
import defaultUrlFilter from './filters/defaultUrlFilter';
import makeInspectors from './inspectors';
import { ParsedOptions, ParsedStackOptions } from './options';
import randomUuidV4 from './randomUuidV4';
import parse from './stack/StackParser';

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

function configureTraceKit(options: ParsedStackOptions) {
  // Include before + after + source line.
  // TraceKit only takes a total context size, so we have to over capture and then reduce the lines.
  // So, for instance if before is 3 and after is 4 we need to capture 4 and 4 and then drop a line
  // from the before context.
  // The typing for this is a bool, but it accepts a number.
  const beforeAfterMax = Math.max(options.source.afterLines, options.source.beforeLines);
  (TraceKit as any).linesOfContext = beforeAfterMax * 2 + 1;
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

  constructor(private options: ParsedOptions) {
    configureTraceKit(options.stack);

    // Error collector is always required.
    this.collectors.push(new ErrorCollector());
    this.collectors.push(...options.collectors);

    this.maxPendingEvents = options.maxPendingEvents;
    this.maxBreadcrumbs = options.breadcrumbs.maxBreadcrumbs;

    const urlFilters = [defaultUrlFilter];
    if (options.breadcrumbs.http.customUrlFilter) {
      urlFilters.push(options.breadcrumbs.http.customUrlFilter);
    }

    if (options.breadcrumbs.http.instrumentFetch) {
      this.collectors.push(
        new FetchCollector({
          urlFilters,
        }),
      );
    }

    if (options.breadcrumbs.http.instrumentXhr) {
      this.collectors.push(
        new XhrCollector({
          urlFilters,
        }),
      );
    }

    if (options.breadcrumbs.click) {
      this.collectors.push(new ClickCollector());
    }

    if (options.breadcrumbs.keyboardInput) {
      this.collectors.push(new KeypressCollector());
    }

    this.collectors.forEach((collector) =>
      collector.register(this as BrowserTelemetry, this.sessionId),
    );

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
    this.client?.track(type, event);
  }

  captureError(exception: Error): void {
    const validException = exception !== undefined && exception !== null;

    const data: ErrorData = validException
      ? {
          type: exception.name || exception.constructor?.name || 'generic',
          message: exception.message,
          stack: parse(exception, this.options.stack),
          breadcrumbs: [...this.breadcrumbs],
          sessionId: this.sessionId,
        }
      : {
          type: 'generic',
          message: 'null or undefined exception',
          stack: { frames: [] },
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
