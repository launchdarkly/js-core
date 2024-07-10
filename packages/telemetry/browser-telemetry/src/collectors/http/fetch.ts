import { BrowserTelemetry } from '../../api/BrowserTelemetry';
import { Collector } from '../../api/Collector';
import decorateFetch from './fetchDecorator';

export default class FetchCollector implements Collector {
  private destination?: BrowserTelemetry;

  constructor() {
    decorateFetch((breadcrumb) => {
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
