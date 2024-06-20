import { BrowserTelemetry } from './api/BrowserTelemetry.js';
import { Options } from './api/Options.js';
import BrowserTelemetryImpl from './BrowserTelemetryImpl.js';
import parse from './options.js';

export { type Breadcrumb } from './api/Breadcrumb.js';
export { type BrowserTelemetry } from './api/BrowserTelemetry.js';

export function initializeTelemetry(options?: Options): BrowserTelemetry {
  const parsedOptions = parse(options || {});
  return new BrowserTelemetryImpl(parsedOptions);
}
