/**
 * The LaunchDarkly client stream processor
 *
 * The client uses this internally to retrieve updates from LaunchDarkly.
 *
 * @ignore
 */
export interface LDStreamProcessor {
  start: (fn?: (err?: any) => void) => void;
  stop: () => void;
  close: () => void;
}
