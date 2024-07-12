import { Collector } from './api/Collector';
import { HttpBreadCrumbOptions, Options, UrlFilter } from './api/Options';

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
  option: HttpBreadCrumbOptions | false | undefined,
  defaults: ParsedHttpOptions,
): ParsedHttpOptions {
  if (option === false) {
    return {
      instrumentFetch: false,
      instrumentXhr: false,
    };
  }

  // Make sure that the custom filter is at least a function.
  const customUrlFilter =
    option?.customUrlFilter && typeof option?.customUrlFilter === 'function'
      ? option.customUrlFilter
      : undefined;

  // TODO: Logging for incorrect types.

  return {
    instrumentFetch: itemOrDefault(option?.instrumentFetch, defaults.instrumentFetch),
    instrumentXhr: itemOrDefault(option?.instrumentFetch, defaults.instrumentXhr),
    customUrlFilter,
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
   * Additional, or custom, collectors.
   */
  collectors: Collector[];
}
