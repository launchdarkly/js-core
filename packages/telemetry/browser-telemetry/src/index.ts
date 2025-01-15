import { BrowserTelemetry } from './api/BrowserTelemetry';
import { Options } from './api/Options';
import BrowserTelemetryImpl from './BrowserTelemetryImpl';
import { safeMinLogger } from './logging';
import parse from './options';

export * from './api';

export function initializeTelemetry(options?: Options): BrowserTelemetry {
  const parsedOptions = parse(options || {}, safeMinLogger(options?.logger));
  return new BrowserTelemetryImpl(parsedOptions);
}
