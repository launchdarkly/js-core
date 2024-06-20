import { BrowserTelemetry } from '../api/BrowserTelemetry.js';
import { Collector } from '../api/Collector.js';

export default class ErrorCollector implements Collector {
  private destination?: BrowserTelemetry;

  constructor() {
    window.addEventListener(
      'error',
      (event: ErrorEvent) => {
        this.destination?.captureErrorEvent(event);
      },
      true,
    );
  }

  register(telemetry: BrowserTelemetry): void {
    this.destination = telemetry;
  }
  unregister(): void {
    this.destination = undefined;
  }
}
