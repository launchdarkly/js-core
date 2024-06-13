import { BrowserTelemetry } from './BrowserTelemetry.js';

export interface Collector {
  register(telemetry: BrowserTelemetry): void;
  unregister(telemetry: BrowserTelemetry): void;
}
