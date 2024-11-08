import { Collector } from '../api/Collector';
import { Recorder } from '../api/Recorder';

export default class ErrorCollector implements Collector {
  private _destination?: Recorder;

  constructor() {
    window.addEventListener(
      'error',
      (event: ErrorEvent) => {
        this._destination?.captureErrorEvent(event);
      },
      true,
    );
    window.addEventListener(
      'unhandledrejection',
      (event: PromiseRejectionEvent) => {
        if (event.reason) {
          this._destination?.captureError(event.reason);
        }
      },
      true,
    );
  }

  register(recorder: Recorder): void {
    this._destination = recorder;
  }
  unregister(): void {
    this._destination = undefined;
  }
}
