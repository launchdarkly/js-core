import type { eventWithTime } from '@rrweb/types';
import * as rrweb from 'rrweb';

import { Recorder } from '../../api';
import { Collector } from '../../api/Collector';
import { ContinuousCapture } from './SessionReplayOptions';

export default class ContinuousReplay implements Collector {
  private _telemetry?: Recorder;
  // TODO: Use a better buffer.
  private _buffer: eventWithTime[] = [];
  private _stopper?: () => void;
  private _visibilityHandler: any;
  private _timerHandle: any;
  private _index: number = 0;
  private _sessionId?: string;

  constructor(options: ContinuousCapture) {
    this._visibilityHandler = () => {
      this._handleVisibilityChange();
    };

    document.addEventListener('visibilitychange', this._visibilityHandler, true);

    this._timerHandle = setInterval(() => {
      // If there are only 2 events, then we just have a snapshot.
      // We can wait to capture until there is some activity.

      // No activity has ocurred, so we don't need to send continuous messages
      // to indicate no state change.
      if (this._buffer.length === 2) {
        return;
      }
      this._recordCapture();
      this._restartCapture();
    }, options.intervalMs);

    this._startCapture();
  }

  register(recorder: Recorder, sessionId: string): void {
    this._telemetry = recorder;
    this._sessionId = sessionId;
  }

  unregister(): void {
    this._stopper?.();
    this._telemetry = undefined;
    document.removeEventListener('visibilitychange', this._visibilityHandler);
    clearInterval(this._timerHandle);
  }

  private _handleVisibilityChange() {
    if (document.visibilityState === 'hidden') {
      // When the visibility changes we want to be sure we record what we have, and then we
      // restart recording in case this visibility change was not for the end of the session.
      this._recordCapture();
      this._restartCapture();
    }
  }

  private _recordCapture(): void {
    // Telemetry and sessionId should always be set at the same time, but check both
    // for correctness.
    if (this._telemetry && this._sessionId) {
      this._telemetry.captureSession({
        events: [...this._buffer],
        index: this._index,
      });
    }

    this._index += 1;
  }

  private _startCapture() {
    const { _buffer: buffer } = this;
    this._stopper = rrweb.record({
      emit: (event) => {
        buffer.push(event);
      },
    });
  }

  private _restartCapture() {
    this._stopper?.();
    this._buffer.length = 0;
    this._startCapture();
  }
}
