import { UiBreadcrumb } from '../../api/Breadcrumb';
import { BrowserTelemetry } from '../../api/BrowserTelemetry';
import { Collector } from '../../api/Collector';
import toSelector from './toSelector';

/**
 * Get the event target. This is wrapped because in some situations a browser may throw when
 * accessing the event target.
 *
 * @param event The event to get the target from.
 * @returns The event target, or undefined if one is not available.
 */
function getTarget(event: MouseEvent): Element | undefined {
  try {
    return event.target as Element;
  } catch {
    return undefined;
  }
}

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

  register(telemetry: BrowserTelemetry): void {
    this.destination = telemetry;
  }
  unregister(): void {
    this.destination = undefined;
  }
}
