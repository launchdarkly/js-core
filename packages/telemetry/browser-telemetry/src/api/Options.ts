import { Collector } from './Collector';

/**
 * Interface for URL filters.
 *
 * Given a URL the filter may return a different string to represent that URL.
 * This string will be included in the telemetry events instead of the original.
 *
 * The URL will be filtered by SDK internal filters before this function is called.
 *
 * To redact a URL entirely return an empty string.
 *
 * Example:
 * customUrlFilter: (url) => {
 *  if (url.includes('secret')) {
 *    return ''
 *  }
 *  return url;
 * }
 */
export interface UrlFilter {
  (url: string): string;
}

export interface HttpBreadCrumbOptions {
  /**
   * If fetch should be instrumented and breadcrumbs included for fetch requests.
   *
   * Defaults to true.
   */
  instrumentFetch?: boolean;

  /**
   * If XMLHttpRequests should be instrumented and breadcrumbs included for XMLHttpRequests.
   *
   * Defaults to true.
   */
  instrumentXhr?: boolean;

  /**
   * Customize URL filtering. This will be applied in addition to some baseline filtering included
   * which redacts components of LaunchDarkly URLs.
   */
  customUrlFilter?: UrlFilter;
}

export interface StackOptions {
  /**
   * Configuration that controls how source is captured.
   */
  source?: {
    /**
     * The number of lines captured before the originating line.
     *
     * Defaults to 3.
     */
    beforeLines?: number;
    /**
     * The number of lines captured after the originating line.
     *
     * Defaults to 3.
     */
    afterLines?: number;

    /**
     * The maximum length of source line to include. Lines longer than this will be
     * trimmed.
     *
     * Defaults to 280.
     */
    maxLineLength?: number;
  };
}

/**
 * Options for configuring browser telemetry.
 */
export interface Options {
  /**
   * The maximum number of pending events. Events may be captured before the LaunchDarkly
   * SDK is initialized and these are stored until they can be sent. This only affects the
   * events captured during initialization.
   */
  maxPendingEvents?: number;
  /**
   * Properties related to automatic breadcrumb collection.
   */
  breadcrumbs?: {
    /**
     * Set the maximum number of breadcrumbs. Defaults to 50.
     */
    maxBreadcrumbs?: number;

    /**
     * True to enable automatic evaluation breadcrumbs. Defaults to true.
     */
    evaluations?: boolean;

    /**
     * True to enable flag change breadcrumbs. Defaults to true.
     */
    flagChange?: boolean;

    /**
     * True to enable click breadcrumbs. Defaults to true.
     */
    click?: boolean;

    /**
     * True to enable input breadcrumbs for keypresses. Defaults to true.
     *
     * Input breadcrumbs do not include entered text, just that text was entered.
     */
    keyboardInput?: boolean;

    /**
     * Controls instrumentation and breadcrumbs for HTTP requests.
     * The default is to instrument XMLHttpRequests and fetch requests.
     *
     * `false` to disable all HTTP breadcrumbs and instrumentation.
     *
     * Example:
     * ```
     * // This would instrument only XmlHttpRequests
     * http: {
     *  instrumentFetch: false
     *  instrumentXhr: true
     * }
     *
     * // Disable all HTTP instrumentation:
     * http: false
     * ```
     */
    http?: HttpBreadCrumbOptions | false;
  };

  /**
   * Additional, or custom, collectors.
   */
  collectors?: Collector[];

  /**
   * Configuration that controls the capture of the stack trace.
   */
  stack?: StackOptions;
}
