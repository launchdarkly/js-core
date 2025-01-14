import { BrowserTelemetry } from './api/BrowserTelemetry';
import { Options } from './api/Options';
import BrowserTelemetryImpl from './BrowserTelemetryImpl';
import parse from './options';

export * from './api';

export function initializeTelemetry(options?: Options): BrowserTelemetry {
  const parsedOptions = parse(options || {});
  return new BrowserTelemetryImpl(parsedOptions);
}
