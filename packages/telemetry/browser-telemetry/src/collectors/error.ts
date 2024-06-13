import { BrowserTelemetry } from '../api/BrowserTelemetry.js';
import { Collector } from '../api/Collector.js';

export default class ErrorCollector implements Collector {
  private destinations: Set<BrowserTelemetry> = new Set();

  constructor() {
    window.addEventListener('error', (event: ErrorEvent) => {
      this.destinations.forEach((destination) => destination.captureErrorEvent(event));
    });
  }

  register(telemetry: BrowserTelemetry): void {
    this.destinations.add(telemetry);
  }
  unregister(telemetry: BrowserTelemetry): void {
    this.destinations.delete(telemetry);
  }
}
