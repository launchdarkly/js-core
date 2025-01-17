/**
 * A limited selection of type information is provided by the browser client SDK.
 * This is only a type dependency and these types should be compatible between
 * SDKs.
 */
import type { LDContext, LDEvaluationDetail, LDInspection } from '@launchdarkly/js-client-sdk';

import { BreadcrumbFilter, LDClientLogging, LDClientTracking, MinLogger } from './api';
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
import { fallbackLogger, prefixLog } from './logging';
import { ParsedOptions, ParsedStackOptions } from './options';
import randomUuidV4 from './randomUuidV4';
import parse from './stack/StackParser';
import { getTraceKit } from './vendor/TraceKit';

// TODO: Use a ring buffer for the breadcrumbs/pending events instead of shifting. (SDK-914)

const CUSTOM_KEY_PREFIX = '$ld:telemetry';
const ERROR_KEY = `${CUSTOM_KEY_PREFIX}:error`;
const SESSION_CAPTURE_KEY = `${CUSTOM_KEY_PREFIX}:sessionCapture`;
const GENERIC_EXCEPTION = 'generic';
const NULL_EXCEPTION_MESSAGE = 'exception was null or undefined';
const MISSING_MESSAGE = 'exception had no message';

/**
 * Given a flag value ensure it is safe for analytics.
 *
 * If the parameter is not safe, then return undefined.
 *
 * TODO: Add limited JSON support. (SDK-916)
 * @param u The value to check.
 * @returns Either the value or undefined.
 */
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

function applyBreadcrumbFilter(
  breadcrumb: Breadcrumb | undefined,
  filter: BreadcrumbFilter,
): Breadcrumb | undefined {
  return breadcrumb === undefined ? undefined : filter(breadcrumb);
}

function configureTraceKit(options: ParsedStackOptions) {
  const TraceKit = getTraceKit();
  // Include before + after + source line.
  // TraceKit only takes a total context size, so we have to over capture and then reduce the lines.
  // So, for instance if before is 3 and after is 4 we need to capture 4 and 4 and then drop a line
  // from the before context.
  // The typing for this is a bool, but it accepts a number.
  const beforeAfterMax = Math.max(options.source.afterLines, options.source.beforeLines);
  // The assignment here has bene split to prevent esbuild from complaining about an assigment to
  // an import. TraceKit exports a single object and the interface requires modifying an exported
  // var.
  const anyObj = TraceKit as any;
  anyObj.linesOfContext = beforeAfterMax * 2 + 1;
}

/**
 * Check if the client supports LDClientLogging.
 *
 * @param client The client to check.
 * @returns True if the client is an instance of LDClientLogging.
 */
function isLDClientLogging(client: unknown): client is LDClientLogging {
  return (client as any).logger !== undefined;
}

export default class BrowserTelemetryImpl implements BrowserTelemetry {
  private _maxPendingEvents: number;
  private _maxBreadcrumbs: number;

  private _pendingEvents: { type: string; data: EventData }[] = [];
  private _client?: LDClientTracking;

  private _breadcrumbs: Breadcrumb[] = [];

  private _inspectorInstances: LDInspection[] = [];
  private _collectors: Collector[] = [];
  private _sessionId: string = randomUuidV4();

  private _logger: MinLogger;

  // Used to ensure we only log the event dropped message once.
  private _eventsDropped: boolean = false;
  // Used to ensure we only log the breadcrumb filter error once.
  private _breadcrumbFilterError: boolean = false;

  constructor(private _options: ParsedOptions) {
    configureTraceKit(_options.stack);

    // Error collector is always required.
    this._collectors.push(new ErrorCollector());
    this._collectors.push(..._options.collectors);

    this._maxPendingEvents = _options.maxPendingEvents;
    this._maxBreadcrumbs = _options.breadcrumbs.maxBreadcrumbs;

    const urlFilters = [defaultUrlFilter];
    if (_options.breadcrumbs.http.customUrlFilter) {
      urlFilters.push(_options.breadcrumbs.http.customUrlFilter);
    }

    if (_options.breadcrumbs.http.instrumentFetch) {
      this._collectors.push(
        new FetchCollector({
          urlFilters,
        }),
      );
    }

    if (_options.breadcrumbs.http.instrumentXhr) {
      this._collectors.push(
        new XhrCollector({
          urlFilters,
        }),
      );
    }

    if (_options.breadcrumbs.click) {
      this._collectors.push(new ClickCollector());
    }

    if (_options.breadcrumbs.keyboardInput) {
      this._collectors.push(new KeypressCollector());
    }

    this._collectors.forEach((collector) =>
      collector.register(this as BrowserTelemetry, this._sessionId),
    );

    const impl = this;
    const inspectors: LDInspection[] = [];
    makeInspectors(_options, inspectors, impl);
    this._inspectorInstances.push(...inspectors);

    // Set the initial logger, it may be replaced when the client is registered.
    // For typescript purposes, we need the logger to be directly set in the constructor.
    this._logger = this._options.logger ?? fallbackLogger;
  }

  register(client: LDClientTracking): void {
    this._client = client;
    // When the client is registered, we need to set the logger again, because we may be able to use the client's
    // logger.
    this._setLogger();
    this._pendingEvents.forEach((event) => {
      this._client?.track(event.type, event.data);
    });
    this._pendingEvents = [];
  }

  private _setLogger() {
    // If the user has provided a logger, then we want to prioritize that over the client's logger.
    // If the client supports LDClientLogging, then we to prioritize that over the fallback logger.
    if (this._options.logger) {
      this._logger = this._options.logger;
    } else if (isLDClientLogging(this._client)) {
      this._logger = this._client.logger;
    } else {
      this._logger = fallbackLogger;
    }
  }

  inspectors(): LDInspection[] {
    return this._inspectorInstances;
  }

  /**
   * Capture an event.
   *
   * If the LaunchDarkly client SDK is not yet registered, then the event
   * will be buffered until the client is registered.
   * @param type The type of event to capture.
   * @param event The event data.
   */
  private _capture(type: string, event: EventData) {
    if (this._client === undefined) {
      this._pendingEvents.push({ type, data: event });
      if (this._pendingEvents.length > this._maxPendingEvents) {
        if (!this._eventsDropped) {
          this._eventsDropped = true;
          this._logger.warn(
            prefixLog(
              `Maximum pending events reached. Old events will be dropped until the SDK client is registered.`,
            ),
          );
        }
        this._pendingEvents.shift();
      }
    }
    this._client?.track(type, event);
  }

  captureError(exception: Error): void {
    const validException = exception !== undefined && exception !== null;

    const data: ErrorData = validException
      ? {
          type: exception.name || exception.constructor?.name || GENERIC_EXCEPTION,
          // Only coalesce null/undefined, not empty.
          message: exception.message ?? MISSING_MESSAGE,
          stack: parse(exception, this._options.stack),
          breadcrumbs: [...this._breadcrumbs],
          sessionId: this._sessionId,
        }
      : {
          type: GENERIC_EXCEPTION,
          message: NULL_EXCEPTION_MESSAGE,
          stack: { frames: [] },
          breadcrumbs: [...this._breadcrumbs],
          sessionId: this._sessionId,
        };
    this._capture(ERROR_KEY, data);
  }

  captureErrorEvent(errorEvent: ErrorEvent): void {
    this.captureError(errorEvent.error);
  }

  captureSession(sessionEvent: EventData): void {
    this._capture(SESSION_CAPTURE_KEY, { ...sessionEvent, breadcrumbs: [...this._breadcrumbs] });
  }

  private _applyBreadcrumbFilters(
    breadcrumb: Breadcrumb,
    filters: BreadcrumbFilter[],
  ): Breadcrumb | undefined {
    try {
      return filters.reduce(
        (breadcrumbToFilter: Breadcrumb | undefined, filter: BreadcrumbFilter) =>
          applyBreadcrumbFilter(breadcrumbToFilter, filter),
        breadcrumb,
      );
    } catch (e) {
      if (!this._breadcrumbFilterError) {
        this._breadcrumbFilterError = true;
        this._logger.warn(prefixLog(`Error applying breadcrumb filters: ${e}`));
      }
      return undefined;
    }
  }

  addBreadcrumb(breadcrumb: Breadcrumb): void {
    const filtered = this._applyBreadcrumbFilters(breadcrumb, this._options.breadcrumbs.filters);
    if (filtered !== undefined) {
      this._breadcrumbs.push(filtered);
      if (this._breadcrumbs.length > this._maxBreadcrumbs) {
        this._breadcrumbs.shift();
      }
    }
  }

  close(): void {
    this._collectors.forEach((collector) => collector.unregister());
  }

  /**
   * Used to automatically collect flag usage for breacrumbs.
   *
   * When session replay is in use the data is also forwarded to the session
   * replay collector.
   *
   * @internal
   */
  handleFlagUsed(flagKey: string, detail: LDEvaluationDetail, _context?: LDContext): void {
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
  }

  /**
   * Used to automatically collect flag detail changes.
   *
   * When session replay is in use the data is also forwarded to the session
   * replay collector.
   *
   * @internal
   */
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
  }
}
