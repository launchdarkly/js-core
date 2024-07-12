import { BrowserTelemetry } from '../../api/BrowserTelemetry';
import { Collector } from '../../api/Collector';
import filterHttpBreadcrumb from '../../filters/filterHttpBreadcrumb';
import HttpCollectorOptions from './HttpCollectorOptions';
import decorateXhr from './xhrDecorator';

/**
 * Instrument XMLHttpRequest and provide a breadcrumb for every XMLHttpRequest
 * which is completed.
 */
export default class XhrCollector implements Collector {
  private destination?: BrowserTelemetry;

  constructor(options: HttpCollectorOptions) {
    decorateXhr((breadcrumb) => {
      filterHttpBreadcrumb(breadcrumb, options);
      this.destination?.addBreadcrumb(breadcrumb);
    });
  }

  register(telemetry: BrowserTelemetry): void {
    this.destination = telemetry;
  }

  unregister(): void {
    this.destination = undefined;
  }
}
