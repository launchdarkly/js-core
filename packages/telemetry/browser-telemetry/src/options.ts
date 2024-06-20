import { Collector } from './api/Collector';
import { Options } from './api/Options';
import ErrorCollector from './collectors/error';

const defaultOptions: ParsedOptions = {
  breadcrumbs: {
    maxBreadcrumbs: 50,
    evaluations: true,
    flagChange: true,
    click: true,
  },
  maxPendingEvents: 100,
  collectors: [new ErrorCollector()],
};

Object.freeze(defaultOptions);

export { defaultOptions };

export default function parse(options: Options): ParsedOptions {
  return {
    breadcrumbs: {
      maxBreadcrumbs:
        options.breadcrumbs?.maxBreadcrumbs || defaultOptions.breadcrumbs.maxBreadcrumbs,
      evaluations: options.breadcrumbs?.evaluations || defaultOptions.breadcrumbs.evaluations,
      flagChange: options.breadcrumbs?.flagChange || defaultOptions.breadcrumbs.flagChange,
      click: options.breadcrumbs?.click || defaultOptions.breadcrumbs.click,
    },
    maxPendingEvents: options.maxPendingEvents || defaultOptions.maxPendingEvents,
    collectors: [...defaultOptions.collectors, ...(options.collectors || [])],
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
