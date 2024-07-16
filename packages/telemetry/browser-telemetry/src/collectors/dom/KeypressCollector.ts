import { Breadcrumb, UiBreadcrumb } from '../../api/Breadcrumb';
import { BrowserTelemetry } from '../../api/BrowserTelemetry';
import { Collector } from '../../api/Collector';
import getTarget from './getTarget';
import toSelector from './toSelector';

const THROTTLE_TIME_MS = 1000;

const INPUT_TAG_NAMES = ['INPUT', 'TEXTAREA'];

/**
 * Collects mouse click events and adds them as breadcrumbs.
 */
export default class KeypressCollector implements Collector {
  private destination?: BrowserTelemetry;
  private lastEvent?: UiBreadcrumb;

  constructor() {
    window.addEventListener(
      'keypress',
      (event: KeyboardEvent) => {
        const target = getTarget(event);
        const htmlElement = target as HTMLElement;
        // An example of `isContentEditable` would be an editable <p> tag.
        // Input and textarea tags do not have the isContentEditable property.
        if (
          target &&
          (INPUT_TAG_NAMES.includes(target.tagName) || htmlElement?.isContentEditable)
        ) {
          const breadcrumb: UiBreadcrumb = {
            class: 'ui',
            type: 'input',
            level: 'info',
            timestamp: Date.now(),
            message: toSelector(target),
          };

          if (!this.shouldDeduplicate(breadcrumb)) {
            this.destination?.addBreadcrumb(breadcrumb);
            this.lastEvent = breadcrumb;
          }
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

  private shouldDeduplicate(crumb: Breadcrumb): boolean {
    // TODO: Consider de-duplication at the dom level.
    if (this.lastEvent) {
      const timeDiff = Math.abs(crumb.timestamp - this.lastEvent.timestamp);
      return this.lastEvent.message === crumb.message && timeDiff <= THROTTLE_TIME_MS;
    }
    return false;
  }
}
