import { Options } from '../api';
import { BrowserTelemetry } from '../api/BrowserTelemetry';
import BrowserTelemetryImpl from '../BrowserTelemetryImpl';
import { fallbackLogger, prefixLog, safeMinLogger } from '../logging';
import parse from '../options';

let telemetryInstance: BrowserTelemetry | undefined;
let warnedClientNotInitialized: boolean = false;

/**
 * Initialize the LaunchDarkly telemetry client
 *
 * This method should be called one time as early as possible in the application lifecycle.
 *
 * @example
 * ```
 * import { initTelemetry } from '@launchdarkly/browser-telemetry';
 *
 * initTelemetry();
 * ```
 *
 * After initialization the telemetry client must be registered with the LaunchDarkly SDK client.
 *
 * @example
 * ```
 * import { initTelemetry, register } from '@launchdarkly/browser-telemetry';
 *
 * initTelemetry();
 *
 * // Create your LaunchDarkly client following the LaunchDarkly SDK documentation.
 *
 * register(ldClient);
 * ```
 *
 * If using the 3.x version of the LaunchDarkly SDK, then you must also add inspectors when intializing your LaunchDarkly client.
 * This allows for integration with feature flag data.
 *
 * @example
 * ```
 * import { initTelemetry, register, inspectors } from '@launchdarkly/browser-telemetry';
 * import { init } from 'launchdarkly-js-client-sdk';
 *
 * initTelemetry();
 *
 * const ldClient = init('YOUR_CLIENT_SIDE_ID', {
 *   inspectors: inspectors()
 * });
 *
 * register(ldClient);
 * ```
 *
 * @param options The options to use for the telemetry instance. Refer to {@link Options} for more information.
 */
export function initTelemetry(options?: Options) {
  const logger = safeMinLogger(options?.logger);

  if (telemetryInstance) {
    logger.warn(prefixLog('Telemetry has already been initialized. Ignoring new options.'));
    return;
  }

  const parsedOptions = parse(options || {}, logger);
  telemetryInstance = new BrowserTelemetryImpl(parsedOptions);
}

/**
 * Get the telemetry instance.
 *
 * In typical operation this method doesn't need to be called. Instead the functions exported by this package directly
 * use the telemetry instance.
 *
 * This function can be used when the telemetry instance needs to be injected into code instead of accessed globally.
 *
 * @returns The telemetry instance, or undefined if it has not been initialized.
 */
export function getTelemetryInstance(): BrowserTelemetry | undefined {
  if (!telemetryInstance) {
    if (warnedClientNotInitialized) {
      return undefined;
    }

    fallbackLogger.warn(prefixLog('Telemetry has not been initialized'));
    warnedClientNotInitialized = true;
    return undefined;
  }

  return telemetryInstance;
}

/**
 * Reset the telemetry instance to its initial state.
 *
 * This method is intended to be used in tests.
 *
 * @internal
 */
export function resetTelemetryInstance() {
  telemetryInstance = undefined;
  warnedClientNotInitialized = false;
}
