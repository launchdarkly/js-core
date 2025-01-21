import type { LDInspection } from '@launchdarkly/js-client-sdk';

import { Breadcrumb } from './Breadcrumb';
import { LDClientTracking } from './client/LDClientTracking';
import { BrowserTelemetryInspector } from './client/BrowserTelemetryInspector';

/**
 * Interface for browser-based telemetry collection in LaunchDarkly SDKs.
 *
 * This interface provides methods for collecting diagnostic information, error
 * tracking, and SDK usage data in browser environments. It is designed to work
 * with LaunchDarkly's JavaScript client-side SDKs for browser environments.
 */
export interface BrowserTelemetry {
  /**
   * Returns an array of active SDK inspectors to use with SDK versions that do
   * not support hooks.
   *
   * @returns An array of {@link LDInspection} objects.
   */
  inspectors(): BrowserTelemetryInspector[];

  /**
   * Captures an Error object for telemetry purposes.
   *
   * Use this method to manually capture errors during application operation.
   * Unhandled errors are automatically captured, but this method can be used
   * to capture errors which were handled, but are still useful for telemetry.
   *
   * @param exception The Error object to capture
   */
  captureError(exception: Error): void;

  /**
   * Captures a browser ErrorEvent for telemetry purposes.
   *
   * This method can be used to capture a manually created error event. Use this
   * function to represent application specific errors which cannot be captured
   * automatically or are not `Error` types.
   *
   * For most errors {@link captureError} should be used.
   *
   * @param errorEvent The ErrorEvent to capture
   */
  captureErrorEvent(errorEvent: ErrorEvent): void;

  /**
   * Add a breadcrumb which will be included with telemetry events.
   *
   * Many breadcrumbs can be automatically captured, but this method can be
   * used for capturing manual breadcrumbs. For application specific breadcrumbs
   * the {@link CustomBreadcrumb} type can be used.
   *
   * @param breadcrumb The breadcrumb to add.
   */
  addBreadcrumb(breadcrumb: Breadcrumb): void;

  /**
   * Registers a LaunchDarkly client instance for telemetry tracking.
   *
   * This method connects the telemetry system to the specific LaunchDarkly
   * client instance. The client instance will be used to report telemetry
   * to LaunchDarkly and also for collecting flag and context data.
   *
   * @param client The {@link LDClientTracking} instance to register for
   * telemetry
   */
  register(client: LDClientTracking): void;

  /**
   * Closes the telemetry system and stops data collection.
   *
   * In general usage this method is not required, but it can be used in cases
   * where collection needs to be stopped independent of application
   * lifecycle.
   */
  close(): void;
}
