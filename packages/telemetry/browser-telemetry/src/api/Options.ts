import { Collector } from './Collector.js';

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
  };

  /**
   * Additional, or custom, collectors.
   */
  collectors?: Collector[];
}
