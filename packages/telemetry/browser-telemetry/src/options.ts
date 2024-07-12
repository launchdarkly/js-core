import { Collector } from './api/Collector';
import { HttpBreadCrumbOptions, Options, StackOptions, UrlFilter } from './api/Options';

export function defaultOptions(): ParsedOptions {
  return {
    breadcrumbs: {
      maxBreadcrumbs: 50,
      evaluations: true,
      flagChange: true,
      click: true,
      http: {
        instrumentFetch: true,
        instrumentXhr: true,
      },
    },
    stack: {
      source: {
        beforeLines: 3,
        afterLines: 3,
        maxLineLength: 280,
      },
    },
    maxPendingEvents: 100,
    collectors: [],
  };
}

function itemOrDefault<T>(item: T | undefined, defaultValue: T): T {
  if (item !== undefined && item !== null) {
    return item;
  }
  return defaultValue;
}

function parseHttp(
  options: HttpBreadCrumbOptions | false | undefined,
  defaults: ParsedHttpOptions,
): ParsedHttpOptions {
  if (options === false) {
    return {
      instrumentFetch: false,
      instrumentXhr: false,
    };
  }

  // Make sure that the custom filter is at least a function.
  const customUrlFilter =
    options?.customUrlFilter && typeof options?.customUrlFilter === 'function'
      ? options.customUrlFilter
      : undefined;

  // TODO: Logging for incorrect types.

  return {
    instrumentFetch: itemOrDefault(options?.instrumentFetch, defaults.instrumentFetch),
    instrumentXhr: itemOrDefault(options?.instrumentFetch, defaults.instrumentXhr),
    customUrlFilter,
  };
}

function parseStack(
  options: StackOptions | undefined,
  defaults: ParsedStackOptions,
): ParsedStackOptions {
  return {
    source: {
      beforeLines: itemOrDefault(options?.source?.beforeLines, defaults.source.beforeLines),
      afterLines: itemOrDefault(options?.source?.afterLines, defaults.source.afterLines),
      maxLineLength: itemOrDefault(options?.source?.maxLineLength, defaults.source.maxLineLength),
    },
  };
}

export default function parse(options: Options): ParsedOptions {
  const defaults = defaultOptions();
  return {
    breadcrumbs: {
      maxBreadcrumbs: itemOrDefault(
        options.breadcrumbs?.maxBreadcrumbs,
        defaults.breadcrumbs.maxBreadcrumbs,
      ),
      evaluations: itemOrDefault(
        options.breadcrumbs?.evaluations,
        defaults.breadcrumbs.evaluations,
      ),
      flagChange: itemOrDefault(options.breadcrumbs?.flagChange, defaults.breadcrumbs.flagChange),
      click: itemOrDefault(options.breadcrumbs?.click, defaults.breadcrumbs.click),
      http: parseHttp(options.breadcrumbs?.http, defaults.breadcrumbs.http),
    },
    stack: parseStack(options.stack, defaults.stack),
    maxPendingEvents: itemOrDefault(options.maxPendingEvents, defaults.maxPendingEvents),
    collectors: [...itemOrDefault(options.collectors, defaults.collectors)],
  };
}

export interface ParsedHttpOptions {
  /**
   * True to instrument fetch and enable fetch breadcrumbs.
   */
  instrumentFetch: boolean;

  /**
   * True to instrument XMLHttpRequests and enable XMLHttpRequests breadcrumbs.
   */
  instrumentXhr: boolean;

  /**
   * Optional custom URL filter.
   */
  customUrlFilter?: UrlFilter;
}

export interface ParsedStackOptions {
  source: {
    /**
     * The number of lines captured before the originating line.
     */
    beforeLines: number;

    /**
     * The number of lines captured after the originating line.
     */
    afterLines: number;

    /**
     * The maximum length of source line to include. Lines longer than this will be
     * trimmed.
     */
    maxLineLength: number;
  };
}

export interface ParsedOptions {
  /**
   * The maximum number of pending events. Events may be captured before the LaunchDarkly
   * SDK is initialized and these are stored until they can be sent. This only affects the
   * events captured during initialization.
   */
  maxPendingEvents: number;
  /**
   * Properties related to automatic breadcrumb collection.
   */
  breadcrumbs: {
    /**
     * Set the maximum number of breadcrumbs. Defaults to 50.
     */
    maxBreadcrumbs: number;

    /**
     * True to enable automatic evaluation breadcrumbs. Defaults to true.
     */
    evaluations: boolean;

    /**
     * True to enable flag change breadcrumbs. Defaults to true.
     */
    flagChange: boolean;

    /**
     * True to enable click breadcrumbs. Defaults to true.
     */
    click: boolean;

    /**
     * Settings for http instrumentation and breadcrumbs.
     */
    http: ParsedHttpOptions;
  };

  /**
   * Settings which affect call stack capture.
   */
  stack: ParsedStackOptions;

  /**
   * Additional, or custom, collectors.
   */
  collectors: Collector[];
}
