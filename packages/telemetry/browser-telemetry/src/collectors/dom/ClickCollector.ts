import { UiBreadcrumb } from '../../api/Breadcrumb';
import { Collector } from '../../api/Collector';
import { Recorder } from '../../api/Recorder';
import getTarget from './getTarget';
import toSelector from './toSelector';

/**
 * Collects mouse click events and adds them as breadcrumbs.
 */
export default class ClickCollector implements Collector {
  private _destination?: Recorder;

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
          this._destination?.addBreadcrumb(breadcrumb);
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
}
