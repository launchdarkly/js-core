/**
 * This is the API reference for the LaunchDarkly Client-Side SDK for JavaScript with included Observability.
 *
 * This SDK is intended for use in browser environments. It includes the observability and session replay plugins.
 *
 * In typical usage, you will call {@link initialize} once at startup time to obtain an instance of
 * {@link LDClient}, which provides access to all of the SDK's functionality.
 *
 * For more information, see the [SDK Reference Guide](https://docs.launchdarkly.com/sdk/client-side/javascript).
 *
 * @packageDocumentation
 */
import { initialize as initializeJsClient, LDClient, LDOptions } from '@launchdarkly/js-client-sdk';
import Observability, { ObserveOptions } from '@launchdarkly/observability';
import SessionReplay, { RecordOptions } from '@launchdarkly/session-replay';

export * from '@launchdarkly/js-client-sdk';

export { LDObserve, ObserveOptions } from '@launchdarkly/observability';
export { LDRecord, RecordOptions } from '@launchdarkly/session-replay';

/**
 * Initialization options for the browser SDK and observability plugins.
 */
export interface LDBrowserOptions extends LDOptions {
  /**
   * The project ID for observability. This is a temporary option and will be removed before the 1.0.0 release.
   */
  tmpProjectId: string;
  /**
   * Configuration for the observability plugin.
   */
  observability?: ObserveOptions;
  /**
   * Configuration for the session replay plugin.
   */
  sessionReplay?: RecordOptions;
}

/**
 * Creates an instance of the LaunchDarkly client. The client is pre-configured for observability.
 *
 * Usage:
 * ```
 * import { initialize } from '@launchdarkly/browser';
 * const client = initialize(clientSideId, context, options);
 * ```
 *
 * @param clientSideId
 *   The client-side ID, also known as the environment ID.
 * @param options
 *   Optional configuration settings.
 * @return
 *   The new client instance.
 */
export function initialize(clientSideId: string, options?: LDBrowserOptions): LDClient {
  const optionsWithPlugins = {
    ...options,
    plugins: [
      ...(options?.plugins || []),
      new Observability(options?.tmpProjectId ?? '1', options?.observability),
      new SessionReplay(options?.tmpProjectId ?? '1', options?.sessionReplay),
    ],
  };
  return initializeJsClient(clientSideId, optionsWithPlugins);
}
