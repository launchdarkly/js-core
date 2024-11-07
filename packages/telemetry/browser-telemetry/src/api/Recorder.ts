import { Breadcrumb } from './Breadcrumb';

/**
 * Interface for capturing telemetry data.
 */
export interface Recorder {
  /**
   * Capture an error.
   *
   * @param exception The exception to capture.
   */
  captureError(exception: Error): void;

  /**
   * Capture an error event.
   *
   * @param errorEvent The error event to capture.
   */
  captureErrorEvent(errorEvent: ErrorEvent): void;

  /**
   * Add a breadcrumb. When a capture is performed breadcrumb data can be
   * included with it.
   *
   * @param breadcrumb The breadcrumb to add.
   */
  addBreadcrumb(breadcrumb: Breadcrumb): void;
}
