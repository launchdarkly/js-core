import { BrowserTelemetry } from './api/BrowserTelemetry';
import { Options } from './api/Options';
import BrowserTelemetryImpl from './BrowserTelemetryImpl';
import { safeMinLogger } from './logging';
import parse from './options';

export * from './api';

export * from './singleton';

/**
 * Initialize a new telemetry instance.
 *
 * This instance is not global. Generally developers should use {@link initializeTelemetry} instead.
 *
 * If for some reason multiple telemetry instances are needed, this method can be used to create a new instance.
 * Instances are not aware of each other and may send duplicate data from automatically captured events.
 *
 * @param options The options to use for the telemetry instance.
 * @returns A telemetry instance.
 */
export function initializeTelemetryInstance(options?: Options): BrowserTelemetry {
  const parsedOptions = parse(options || {}, safeMinLogger(options?.logger));
  return new BrowserTelemetryImpl(parsedOptions);
}
