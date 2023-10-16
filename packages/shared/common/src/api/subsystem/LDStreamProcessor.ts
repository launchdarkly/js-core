/**
 * The LaunchDarkly client stream processor
 *
 * The client uses this internally to retrieve updates from LaunchDarkly.
 *
 * @ignore
 */
export interface LDStreamProcessor {
  start: () => void;
  stop: () => void;
  close: () => void;
}
