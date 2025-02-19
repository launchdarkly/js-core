import { Collector } from '../../api/Collector';
import { Recorder } from '../../api/Recorder';
import filterHttpBreadcrumb from '../../filters/filterHttpBreadcrumb';
import HttpCollectorOptions from './HttpCollectorOptions';
import decorateXhr from './xhrDecorator';

/**
 * Instrument XMLHttpRequest and provide a breadcrumb for every XMLHttpRequest
 * which is completed.
 */
export default class XhrCollector implements Collector {
  private _destination?: Recorder;
  private _loggedIssue: boolean = false;

  constructor(options: HttpCollectorOptions) {
    decorateXhr((breadcrumb) => {
      let filtersExecuted = false;
      try {
        filterHttpBreadcrumb(breadcrumb, options);
        filtersExecuted = true;
      } catch (err) {
        if (!this._loggedIssue) {
          options.getLogger?.()?.warn('Error filtering http breadcrumb', err);
          this._loggedIssue = true;
        }
      }
      // Only add the breadcrumb if the filter didn't throw. We don't want to
      // report a breadcrumb that may have not have had the correct information redacted.
      if (filtersExecuted) {
        this._destination?.addBreadcrumb(breadcrumb);
      }
    });
  }

  register(recorder: Recorder, _sessionId: string): void {
    this._destination = recorder;
  }

  unregister(): void {
    this._destination = undefined;
  }
}
