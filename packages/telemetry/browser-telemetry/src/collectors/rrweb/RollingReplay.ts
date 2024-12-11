import * as rrweb from 'rrweb';

import { Recorder } from '../../api';
import { Collector } from '../../api/Collector';
import RollingBuffer from './RollingBuffer';
import { RollingCapture } from './SessionReplayOptions';

export default class RollingReplay implements Collector {
  private _recorder?: Recorder;
  private _buffer: RollingBuffer;
  private _stopper?: () => void;
  private _index: number = 0;
  private _sessionId?: string;

  constructor(private _options: RollingCapture) {
    this._buffer = new RollingBuffer(_options.eventSegmentLength, _options.segmentBufferLength);

    this._startCapture();
  }

  private _startCapture() {
    this._stopper = rrweb.record({
      checkoutEveryNth: this._options.eventSegmentLength,
      emit: (event) => {
        this._buffer.push(event);
      },
    });
  }

  register(recorder: Recorder, sessionId: string): void {
    this._recorder = recorder;
    this._sessionId = sessionId;
  }

  unregister(): void {
    this._stopper?.();
    this._recorder = undefined;
  }

  capture(): void {
    // Telemetry and sessionId should always be set at the same time, but check both
    // for correctness.
    if (this._recorder && this._sessionId) {
      this._recorder?.captureSession({
        events: this._buffer.toArray(),
        index: this._index,
      });
    }
    this._index += 1;
    this._restartCapture();
  }

  private _restartCapture() {
    this._buffer.reset();
    this._stopper?.();
    this._startCapture();
  }
}
