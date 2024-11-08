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

  constructor(options: HttpCollectorOptions) {
    decorateXhr((breadcrumb) => {
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
