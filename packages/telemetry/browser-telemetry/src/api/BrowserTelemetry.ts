import { LDClient, LDInspection } from 'launchdarkly-js-client-sdk';

import { Recorder } from './Recorder';

/**
 * Interface LaunchDarkly browser telemetry.
 */
export interface BrowserTelemetry extends Recorder {
  /**
   * Get inspectors to use with the LaunchDarkly client.
   */
  inspectors(): LDInspection[];

  // TODO: Consider hooks as well. Hooks will allow registration to happen in a
  // single step.

  /**
   * Register the telemetry instance with the LaunchDarkly client.
   *
   * @param client The LaunchDarkly client.
   */
  register(client: LDClient): void;

  /**
   * Close the telemetry client.
   */
  close(): void;
}
