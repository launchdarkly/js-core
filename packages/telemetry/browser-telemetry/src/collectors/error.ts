import TraceKit from 'tracekit';
import { BrowserTelemetry } from '../api/BrowserTelemetry';
import { Collector } from '../api/Collector';
import { ParsedStackOptions } from '../options';


export default class ErrorCollector implements Collector {
  private destination?: BrowserTelemetry;

  constructor(options: ParsedStackOptions) {
    // Include before + after + source line.
    // @ts-ignore The typing for this is a bool, but it accepts a number.
    // eslint-disable-next-line prettier/prettier
    TraceKit?.linesOfContext = options.source.beforeLines + options.source.afterLines + 1;

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
