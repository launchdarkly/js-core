import * as rrweb from 'rrweb';

import { BrowserTelemetry } from '../../api/BrowserTelemetry';
import { Collector } from '../../api/Collector';
import RollingBuffer from './RollingBuffer';
import { RollingCapture } from './SessionReplayOptions';

export default class RollingReplay implements Collector {
  private telemetry?: BrowserTelemetry;
  private buffer: RollingBuffer;
  private stopper?: () => void;

  constructor(options: RollingCapture) {
    this.buffer = new RollingBuffer(options.eventSegmentLength, options.segmentBufferLength);

    const { buffer } = this;
    this.stopper = rrweb.record({
      checkoutEveryNth: options.eventSegmentLength,
      emit(event) {
        buffer.push(event);
      },
    });
  }

  register(telemetry: BrowserTelemetry): void {
    this.telemetry = telemetry;
  }

  unregister(): void {
    this.stopper?.();
    this.telemetry = undefined;
  }

  capture(): void {
    this.telemetry?.captureSession({
      id: crypto.randomUUID(),
      events: this.buffer.toArray(),
    });
  }
}
