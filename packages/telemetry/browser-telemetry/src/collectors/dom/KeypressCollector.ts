import { Breadcrumb, UiBreadcrumb } from '../../api/Breadcrumb';
import { Collector } from '../../api/Collector';
import { Recorder } from '../../api/Recorder';
import getTarget from './getTarget';
import toSelector from './toSelector';

const THROTTLE_TIME_MS = 1000;

const INPUT_TAG_NAMES = ['INPUT', 'TEXTAREA'];

/**
 * Collects mouse click events and adds them as breadcrumbs.
 */
export default class KeypressCollector implements Collector {
  private _destination?: Recorder;
  private _lastEvent?: UiBreadcrumb;

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

          if (!this._shouldDeduplicate(breadcrumb)) {
            this._destination?.addBreadcrumb(breadcrumb);
            this._lastEvent = breadcrumb;
          }
        }
      },
      true,
    );
  }

  register(recorder: Recorder, _sessionId: string): void {
    this._destination = recorder;
  }
  unregister(): void {
    this._destination = undefined;
  }

  private _shouldDeduplicate(crumb: Breadcrumb): boolean {
    // TODO: Consider de-duplication at the dom level.
    if (this._lastEvent) {
      const timeDiff = Math.abs(crumb.timestamp - this._lastEvent.timestamp);
      return this._lastEvent.message === crumb.message && timeDiff <= THROTTLE_TIME_MS;
    }
    return false;
  }
}
