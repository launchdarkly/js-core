import { UiBreadcrumb } from '../../api/Breadcrumb';
import { BrowserTelemetry } from '../../api/BrowserTelemetry';
import { Collector } from '../../api/Collector';
import getTarget from './getTarget';
import toSelector from './toSelector';

/**
 * Collects mouse click events and adds them as breadcrumbs.
 */
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
            message: toSelector(target),
          };
          this.destination?.addBreadcrumb(breadcrumb);
        }
      },
      true,
    );
  }

  register(telemetry: BrowserTelemetry, _sessionId: string): void {
    this.destination = telemetry;
  }
  unregister(): void {
    this.destination = undefined;
  }
}
