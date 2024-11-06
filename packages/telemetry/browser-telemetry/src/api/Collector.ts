import { Recorder } from './Recorder';

/**
 * Interface to be implemented by collectors.
 *
 * Collectors collect data and inform the client of events.
 *
 * For instance a collector may notify the telemetry instance of HTTP navigation
 * or of UI events. A collector can be created independently of a {@link Recorder}
 * and can begin collecting immediately. It may queue information until it can
 * be registered with a recorder.
 */
export interface Collector {
  /**
   * Register the collector with a recorder.
   * @param recorder Recorder to report events or breadcrumbs to.
   * @param sessionId The current session ID.
   */
  register(recorder: Recorder, sessionId: string): void;

  /**
   * Unregister the collector. It will stop sending events to the recorder.
   */
  unregister(): void;
}
