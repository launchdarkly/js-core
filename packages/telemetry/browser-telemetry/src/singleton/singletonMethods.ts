import type { LDInspection } from '@launchdarkly/js-client-sdk';

import { LDClientTracking } from '../api';
import { Breadcrumb } from '../api/Breadcrumb';
import { getTelemetryInstance } from './singletonInstance';

/**
 * Returns an array of active SDK inspectors to use with SDK versions that do
 * not support hooks.
 *
 * Telemetry must be initialized, using {@link initializeTelemetry} before calling this method.
 * If telemetry is not initialized, this method will return an empty array.
 *
 * @returns An array of {@link LDInspection} objects.
 */
export function inspectors(): LDInspection[] {
  return getTelemetryInstance()?.inspectors() || [];
}

/**
 * Captures an Error object for telemetry purposes.
 *
 * Use this method to manually capture errors during application operation.
 * Unhandled errors are automatically captured, but this method can be used
 * to capture errors which were handled, but are still useful for telemetry.
 *
 * Telemetry must be initialized, using {@link initializeTelemetry} before calling this method.
 * If telemetry is not initialized, then the exception will be discarded.
 *
 * @param exception The Error object to capture
 */
export function captureError(exception: Error): void {
  getTelemetryInstance()?.captureError(exception);
}

/**
 * Captures a browser ErrorEvent for telemetry purposes.
 *
 * This method can be used to capture a manually created error event. Use this
 * function to represent application specific errors which cannot be captured
 * automatically or are not `Error` types.
 *
 * For most errors {@link captureError} should be used.
 *
 * Telemetry must be initialized, using {@link initializeTelemetry} before calling this method.
 * If telemetry is not initialized, then the error event will be discarded.
 *
 * @param errorEvent The ErrorEvent to capture
 */
export function captureErrorEvent(errorEvent: ErrorEvent): void {
  getTelemetryInstance()?.captureErrorEvent(errorEvent);
}

/**
 * Add a breadcrumb which will be included with telemetry events.
 *
 * Many breadcrumbs can be automatically captured, but this method can be
 * used for capturing manual breadcrumbs. For application specific breadcrumbs
 * the {@link CustomBreadcrumb} type can be used.
 *
 * Telemetry must be initialized, using {@link initializeTelemetry} before calling this method.
 * If telemetry is not initialized, then the breadcrumb will be discarded.
 *
 * @param breadcrumb The breadcrumb to add.
 */
export function addBreadcrumb(breadcrumb: Breadcrumb): void {
  getTelemetryInstance()?.addBreadcrumb(breadcrumb);
}

/**
 * Registers a LaunchDarkly client instance for telemetry tracking.
 *
 * This method connects the telemetry system to the specific LaunchDarkly
 * client instance. The client instance will be used to report telemetry
 * to LaunchDarkly and also for collecting flag and context data.
 *
 * Telemetry must be initialized, using {@link initializeTelemetry} before calling this method.
 * If telemetry is not initialized, then the client will not be registered, and no events will be sent to LaunchDarkly.
 *
 * @param client The {@link LDClientTracking} instance to register for
 * telemetry.
 */
export function register(client: LDClientTracking): void {
  getTelemetryInstance()?.register(client);
}

/**
 * Closes the telemetry system and stops data collection.
 *
 * In general usage this method is not required, but it can be used in cases
 * where collection needs to be stopped independent of application
 * lifecycle.
 *
 * If telemetry is not initialized, using {@link initializeTelemetry}, then this method will do nothing.
 */
export function close(): void {
  getTelemetryInstance()?.close();
}
