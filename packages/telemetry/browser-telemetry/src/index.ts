import { BrowserTelemetry } from './api/BrowserTelemetry';
import { Options } from './api/Options';
import BrowserTelemetryImpl from './BrowserTelemetryImpl';
import parse from './options';

export { type Breadcrumb } from './api/Breadcrumb';
export { type BrowserTelemetry } from './api/BrowserTelemetry';
export { type Options } from './api/Options';

export function initializeTelemetry(options?: Options): BrowserTelemetry {
  const parsedOptions = parse(options || {});
  return new BrowserTelemetryImpl(parsedOptions);
}
