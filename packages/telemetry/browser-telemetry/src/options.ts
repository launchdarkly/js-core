import { Collector } from './api/Collector';
import { MinLogger } from './api/MinLogger';
import {
  BreadcrumbFilter,
  BreadcrumbsOptions,
  ErrorDataFilter,
  HttpBreadcrumbOptions,
  Options,
  StackOptions,
  UrlFilter,
} from './api/Options';
import { fallbackLogger, prefixLog, safeMinLogger } from './logging';

const disabledBreadcrumbs: ParsedBreadcrumbsOptions = {
  maxBreadcrumbs: 0,
  evaluations: false,
  flagChange: false,
  click: false,
  keyboardInput: false,
  http: {
    instrumentFetch: false,
    instrumentXhr: false,
    customUrlFilter: undefined,
  },
  filters: [],
};

const disabledStack: ParsedStackOptions = {
  enabled: false,
  source: {
    beforeLines: 0,
    afterLines: 0,
    maxLineLength: 0,
  },
};

export function defaultOptions(): ParsedOptions {
  return {
    breadcrumbs: {
      maxBreadcrumbs: 50,
      evaluations: true,
      flagChange: true,
      click: true,
      keyboardInput: true,
      http: {
        instrumentFetch: true,
        instrumentXhr: true,
      },
      filters: [],
    },
    stack: {
      enabled: true,
      source: {
        beforeLines: 3,
        afterLines: 3,
        maxLineLength: 280,
      },
    },
    maxPendingEvents: 100,
    collectors: [],
    errorFilters: [],
  };
}

function wrongOptionType(name: string, expectedType: string, actualType: string): string {
  return prefixLog(
    `Config option "${name}" should be of type ${expectedType}, got ${actualType}, using default value`,
  );
}

function checkBasic<T>(type: string, name: string, logger?: MinLogger): (item: T) => boolean {
  return (item: T) => {
    const actualType = typeof item;
    if (actualType === type) {
      return true;
    }
    logger?.warn(wrongOptionType(name, type, actualType));
    return false;
  };
}

function itemOrDefault<T>(item: T | undefined, defaultValue: T, checker?: (item: T) => boolean): T {
  if (item !== undefined && item !== null) {
    if (!checker) {
      return item;
    }
    if (checker(item)) {
      return item;
    }
  }
  return defaultValue;
}

function parseHttp(
  options: HttpBreadcrumbOptions | false | undefined,
  defaults: ParsedHttpOptions,
  logger?: MinLogger,
): ParsedHttpOptions {
  if (options !== undefined && options !== false && typeof options !== 'object') {
    logger?.warn(
      wrongOptionType('breadcrumbs.http', 'HttpBreadCrumbOptions | false', typeof options),
    );
    return defaults;
  }

  if (options === false) {
    return {
      instrumentFetch: false,
      instrumentXhr: false,
    };
  }

  // Make sure that the custom filter is at least a function.
  if (options?.customUrlFilter) {
    if (typeof options.customUrlFilter !== 'function') {
      logger?.warn(
        prefixLog(
          `The "breadcrumbs.http.customUrlFilter" must be a function. Received ${typeof options.customUrlFilter}`,
        ),
      );
    }
  }
  const customUrlFilter =
    options?.customUrlFilter && typeof options?.customUrlFilter === 'function'
      ? options.customUrlFilter
      : undefined;

  return {
    instrumentFetch: itemOrDefault(
      options?.instrumentFetch,
      defaults.instrumentFetch,
      checkBasic('boolean', 'breadcrumbs.http.instrumentFetch', logger),
    ),
    instrumentXhr: itemOrDefault(
      options?.instrumentXhr,
      defaults.instrumentXhr,
      checkBasic('boolean', 'breadcrumbs.http.instrumentXhr', logger),
    ),
    customUrlFilter,
  };
}

function parseLogger(options: Options): MinLogger | undefined {
  if (options.logger) {
    const { logger } = options;
    if (typeof logger === 'object' && logger !== null && 'warn' in logger) {
      return safeMinLogger(logger);
    }
    // Using console.warn here because the logger is not suitable to log with.
    fallbackLogger.warn(wrongOptionType('logger', 'MinLogger or LDLogger', typeof logger));
  }
  return undefined;
}

function parseStack(
  options: StackOptions | false | undefined,
  defaults: ParsedStackOptions,
  logger?: MinLogger,
): ParsedStackOptions {
  if (options === false) {
    return disabledStack;
  }
  return {
    // Internal option not parsed from the options object.
    enabled: true,
    source: {
      beforeLines: itemOrDefault(
        options?.source?.beforeLines,
        defaults.source.beforeLines,
        checkBasic('number', 'stack.beforeLines', logger),
      ),
      afterLines: itemOrDefault(
        options?.source?.afterLines,
        defaults.source.afterLines,
        checkBasic('number', 'stack.afterLines', logger),
      ),
      maxLineLength: itemOrDefault(
        options?.source?.maxLineLength,
        defaults.source.maxLineLength,
        checkBasic('number', 'stack.maxLineLength', logger),
      ),
    },
  };
}

function parseBreadcrumbs(
  options: BreadcrumbsOptions | false | undefined,
  defaults: ParsedBreadcrumbsOptions,
  logger: MinLogger | undefined,
): ParsedBreadcrumbsOptions {
  if (options === false) {
    return disabledBreadcrumbs;
  }
  return {
    maxBreadcrumbs: itemOrDefault(
      options?.maxBreadcrumbs,
      defaults.maxBreadcrumbs,
      checkBasic('number', 'breadcrumbs.maxBreadcrumbs', logger),
    ),
    evaluations: itemOrDefault(
      options?.evaluations,
      defaults.evaluations,
      checkBasic('boolean', 'breadcrumbs.evaluations', logger),
    ),
    flagChange: itemOrDefault(
      options?.flagChange,
      defaults.flagChange,
      checkBasic('boolean', 'breadcrumbs.flagChange', logger),
    ),
    click: itemOrDefault(
      options?.click,
      defaults.click,
      checkBasic('boolean', 'breadcrumbs.click', logger),
    ),
    keyboardInput: itemOrDefault(
      options?.keyboardInput,
      defaults.keyboardInput,
      checkBasic('boolean', 'breadcrumbs.keyboardInput', logger),
    ),
    http: parseHttp(options?.http, defaults.http, logger),
    filters: itemOrDefault(options?.filters, defaults.filters, (item) => {
      if (Array.isArray(item)) {
        return true;
      }
      logger?.warn(wrongOptionType('breadcrumbs.filters', 'BreadcrumbFilter[]', typeof item));
      return false;
    }),
  };
}

export default function parse(options: Options, logger?: MinLogger): ParsedOptions {
  const defaults = defaultOptions();
  if (options.breadcrumbs) {
    checkBasic('object', 'breadcrumbs', logger)(options.breadcrumbs);
  }
  if (options.stack) {
    checkBasic('object', 'stack', logger)(options.stack);
  }
  return {
    breadcrumbs: parseBreadcrumbs(options.breadcrumbs, defaults.breadcrumbs, logger),
    stack: parseStack(options.stack, defaults.stack, logger),
    maxPendingEvents: itemOrDefault(
      options.maxPendingEvents,
      defaults.maxPendingEvents,
      checkBasic('number', 'maxPendingEvents', logger),
    ),
    collectors: [
      ...itemOrDefault(options.collectors, defaults.collectors, (item) => {
        if (Array.isArray(item)) {
          return true;
        }
        logger?.warn(wrongOptionType('collectors', 'Collector[]', typeof item));
        return false;
      }),
    ],
    logger: parseLogger(options),
    errorFilters: itemOrDefault(options.errorFilters, defaults.errorFilters, (item) => {
      if (Array.isArray(item)) {
        return true;
      }
      logger?.warn(wrongOptionType('errorFilters', 'ErrorDataFilter[]', typeof item));
      return false;
    }),
  };
}

/**
 * Internal type for parsed http options.
 * @internal
 */
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

/**
 * Internal type for parsed stack options.
 * @internal
 */
export interface ParsedStackOptions {
  enabled: boolean;
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

/**
 * Internal type for parsed breadcrumbs options.
 * @internal
 */
export interface ParsedBreadcrumbsOptions {
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
   * True to enable input breadcrumbs for keypresses. Defaults to true.
   */
  keyboardInput?: boolean;

  /**
   * Settings for http instrumentation and breadcrumbs.
   */
  http: ParsedHttpOptions;

  /**
   * Custom breadcrumb filters.
   */
  filters: BreadcrumbFilter[];
}

/**
 * Internal type for parsed options.
 * @internal
 */
export interface ParsedOptions {
  /**
   * The maximum number of pending events. Events may be captured before the LaunchDarkly
   * SDK is initialized and these are stored until they can be sent. This only affects the
   * events captured during initialization.
   */
  maxPendingEvents: number;

  /**
   * Properties related to automatic breadcrumb collection, or `false` to disable automatic breadcrumbs.
   */
  breadcrumbs: ParsedBreadcrumbsOptions;

  /**
   * Settings which affect call stack capture, or `false` to exclude stack frames from error events .
   */
  stack: ParsedStackOptions;

  /**
   * Additional, or custom, collectors.
   */
  collectors: Collector[];

  /**
   * Logger to use for warnings.
   */
  logger?: MinLogger;

  /**
   * Custom error data filters.
   */
  errorFilters: ErrorDataFilter[];
}
