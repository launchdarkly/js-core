import { BrowserTelemetry } from '../api/BrowserTelemetry.js';
import { Collector } from '../api/Collector.js';

function getTarget(event: MouseEvent): Element | undefined {
  try {
    return event.target as Element;
  } catch {
    return undefined;
  }
}

export default class ClickCollector implements Collector {
  private destination?: BrowserTelemetry;

  constructor() {
    window.addEventListener(
      'click',
      (event: MouseEvent) => {
        const target = getTarget(event);
        if (target) {
          this.destination?.addBreadcrumb({
            type: 'click',
            target: {
              // TODO: Add a query selector.
              id: target.id,
            },
          });
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
