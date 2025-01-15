import { Breadcrumb } from './Breadcrumb';
import { SessionData } from './SessionData';

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

  /**
   * Capture rrweb session data.
   *
   * Currently capturing session replay data is only possible via a collector. It cannot be manually
   * captured using the browser telemetry instance.
   *
   * @param sessionEvent Event containing rrweb session data.
   */
  captureSession(sessionEvent: SessionData): void;
}
