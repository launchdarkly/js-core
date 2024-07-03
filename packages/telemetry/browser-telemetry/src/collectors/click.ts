import { UiBreadcrumb } from '../api/Breadcrumb';
import { BrowserTelemetry } from '../api/BrowserTelemetry';
import { Collector } from '../api/Collector';

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
          const breadcrumb: UiBreadcrumb = {
            class: 'ui',
            type: 'click',
            level: 'info',
            timestamp: Date.now(),
            message: target.id, // TODO: Implement something useful. Ideally a selector.
          };
          this.destination?.addBreadcrumb(breadcrumb);
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
