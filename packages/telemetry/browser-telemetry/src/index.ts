import { BrowserTelemetry } from './api/BrowserTelemetry.js';
import BrowserTelemetryImpl from './BrowserTelemetryImpl.js';
import ClickCollector from './collectors/click.js';
import ErrorCollector from './collectors/error.js';

export { type Breadcrumb } from './api/Breadcrumb.js';
export { type BrowserTelemetry } from './api/BrowserTelemetry.js';

export function initializeTelemetry(): BrowserTelemetry {
  return new BrowserTelemetryImpl([new ClickCollector(), new ErrorCollector()]);
}
