import { BrowserTelemetry } from '../api/BrowserTelemetry';
import { Collector } from '../api/Collector';

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
    window.addEventListener(
      'unhandledrejection',
      (event: PromiseRejectionEvent) => {
        if (event.reason) {
          this.destination?.captureError(event.reason);
        }
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
