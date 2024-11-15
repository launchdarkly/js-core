/**
 * Minimal client interface which allows for tracking. Should work with all client-side
 * JavaScript packages.
 */
export interface LDClientTracking {
  track(key: string, data?: any, metricValue?: number): void;
}
