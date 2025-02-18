import { Collector } from '../../api/Collector';
import { Recorder } from '../../api/Recorder';
import filterHttpBreadcrumb from '../../filters/filterHttpBreadcrumb';
import decorateFetch from './fetchDecorator';
import HttpCollectorOptions from './HttpCollectorOptions';

/**
 * Instrument fetch requests and generate a breadcrumb for each request.
 */
export default class FetchCollector implements Collector {
  private _destination?: Recorder;
  private _loggedIssue: boolean = false;

  constructor(options: HttpCollectorOptions) {
    decorateFetch((breadcrumb) => {
      let filtered = false;
      try {
        filterHttpBreadcrumb(breadcrumb, options);
        filtered = true;
      } catch (err) {
        if (!this._loggedIssue) {
          options.getLogger?.()?.warn('Error filtering http breadcrumb', err);
          this._loggedIssue = true;
        }
      }
      // Only add the breadcrumb if the filter didn't throw. We don't want to
      // report a breadcrumb that may have not have had the correct information redacted.
      if (filtered) {
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
