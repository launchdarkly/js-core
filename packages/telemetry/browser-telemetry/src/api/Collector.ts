import { BrowserTelemetry } from './BrowserTelemetry';

export interface Collector {
  register(telemetry: BrowserTelemetry): void;
  unregister(): void;
}
