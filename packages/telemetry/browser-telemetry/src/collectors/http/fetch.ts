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

  constructor(options: HttpCollectorOptions) {
    decorateFetch((breadcrumb) => {
      filterHttpBreadcrumb(breadcrumb, options);
      this._destination?.addBreadcrumb(breadcrumb);
    });
  }

  register(recorder: Recorder, _sessionId: string): void {
    this._destination = recorder;
  }

  unregister(): void {
    this._destination = undefined;
  }
}
