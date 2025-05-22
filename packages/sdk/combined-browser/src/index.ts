import { initialize as initializeJsClient, LDClient, LDOptions } from '@launchdarkly/js-client-sdk';
import Observability from '@launchdarkly/observability';
import SessionReplay from '@launchdarkly/session-replay';

export * from '@launchdarkly/js-client-sdk';

// TODO: Temporary until the type definitions are exported from the plugins.
type ObserveOptions = ConstructorParameters<typeof Observability>[1];
type RecordOptions = ConstructorParameters<typeof SessionReplay>[1];

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
