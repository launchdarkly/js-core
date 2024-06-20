import { Collector } from './api/Collector';
import { Options } from './api/Options';

export function defaultOptions(): ParsedOptions {
  return {
    breadcrumbs: {
      maxBreadcrumbs: 50,
      evaluations: true,
      flagChange: true,
      click: true,
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
    },
    maxPendingEvents: itemOrDefault(options.maxPendingEvents, defaults.maxPendingEvents),
    collectors: [...itemOrDefault(options.collectors, defaults.collectors)],
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
  };

  /**
   * Additional, or custom, collectors.
   */
  collectors: Collector[];
}
