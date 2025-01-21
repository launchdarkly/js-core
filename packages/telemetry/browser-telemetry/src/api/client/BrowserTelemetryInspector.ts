/**
 * A less constrained version of the LDInspection interface in order to allow for greater compatibility between
 * SDK versions.
 *
 * This interface is not intended for use by the application developer and is instead intended as a compatibility bridge
 *  to support multiple SDK versions.
 */
export interface BrowserTelemetryInspector {
  /**
   * The telemetry package only requires flag-detail-changed inspectors and flag-used inspectors.
   */
  type: 'flag-used' | 'flag-detail-changed';

  /**
   * The name of the inspector, used for debugging purposes.
   */
  name: string;
  /**
   * Whether the inspector is synchronous.
   */
  synchronous: boolean;
  /**
   * The method to call when the inspector is triggered.
   *
   * The typing here is intentionally loose to allow for greater compatibility between SDK versions.
   * This function should ONLY be called by an SDK instance and not by an application developer.
   */
  method: (...args: any[]) => void;
}
