import * as rrweb from 'rrweb';

import { BrowserTelemetry } from '../../api/BrowserTelemetry';
import { Collector } from '../../api/Collector';
import { ContinuousCapture } from './SessionReplayOptions';

export default class ContinuousReplay implements Collector {
  private telemetry?: BrowserTelemetry;
  // TODO: Use a better buffer.
  private buffer: any[] = [];
  private stopper?: () => void;
  private visibilityHandler: any;
  private timerHandle: any;
  private index: number = 0;
  private sessionId?: string;

  constructor(options: ContinuousCapture) {
    this.visibilityHandler = () => {
      this.handleVisibilityChange();
    };

    document.addEventListener('visibilitychange', this.visibilityHandler, true);

    this.timerHandle = setInterval(() => {
      // If there are only 2 events, then we just have a snapshot.
      // We can wait to capture until there is some activity.
      // TODO: Figure out a better check.
      if (this.buffer.length === 2) {
        return;
      }
      this.recordCapture();
      this.restartCapture();
    }, options.intervalMs);

    this.startCapture();
  }

  register(telemetry: BrowserTelemetry, sessionId: string): void {
    this.telemetry = telemetry;
    this.sessionId = sessionId;
  }

  unregister(): void {
    this.stopper?.();
    this.telemetry = undefined;
    document.removeEventListener('visibilitychange', this.visibilityHandler);
    clearInterval(this.timerHandle);
  }

  private handleVisibilityChange() {
    if (document.visibilityState === 'hidden') {
      // When the visibility changes we want to be sure we record what we have, and then we
      // restart recording in case this visibility change was not for the end of the session.
      this.recordCapture();
      this.restartCapture();
    }
  }

  private recordCapture(): void {
    // Telemetry and sessionId should always be set at the same time, but check both
    // for correctness.
    if (this.telemetry && this.sessionId) {
      this.telemetry.captureSession({
        id: this.sessionId,
        events: [...this.buffer],
        index: this.index,
      });
    }

    this.index += 1;
  }

  private startCapture() {
    const { buffer } = this;
    this.stopper = rrweb.record({
      emit: (event) => {
        buffer.push(event);
      },
    });
  }

  private restartCapture() {
    this.stopper?.();
    this.buffer.length = 0;
    this.startCapture();
  }
}
