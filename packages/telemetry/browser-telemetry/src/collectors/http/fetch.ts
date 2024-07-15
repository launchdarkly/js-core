import { BrowserTelemetry } from '../../api/BrowserTelemetry';
import { Collector } from '../../api/Collector';
import filterHttpBreadcrumb from '../../filters/filterHttpBreadcrumb';
import decorateFetch from './fetchDecorator';
import HttpCollectorOptions from './HttpCollectorOptions';

/**
 * Instrument fetch requests and generate a breadcrumb for each request.
 */
export default class FetchCollector implements Collector {
  private destination?: BrowserTelemetry;

  constructor(options: HttpCollectorOptions) {
    decorateFetch((breadcrumb) => {
      filterHttpBreadcrumb(breadcrumb, options);
      this.destination?.addBreadcrumb(breadcrumb);
    });
  }

  register(telemetry: BrowserTelemetry, _sessionId: string): void {
    this.destination = telemetry;
  }

  unregister(): void {
    this.destination = undefined;
  }
}
