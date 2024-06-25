import * as rrweb from 'rrweb';

import { BrowserTelemetry } from '../../api/BrowserTelemetry';
import { Collector } from '../../api/Collector';
import RollingBuffer from './RollingBuffer';
import { RollingCapture } from './SessionReplayOptions';

// Currently the rolling replay supports only 1

export default class RollingReplay implements Collector {
  private telemetry?: BrowserTelemetry;
  private buffer: RollingBuffer;
  private stopper?: () => void;
  private index: number = 0;

  constructor(private options: RollingCapture) {
    this.buffer = new RollingBuffer(options.eventSegmentLength, options.segmentBufferLength);

    this.startCapture();
  }

  private startCapture() {
    this.stopper = rrweb.record({
      checkoutEveryNth: this.options.eventSegmentLength,
      emit: (event) => {
        this.buffer.push(event);
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
      index: this.index,
    });
    this.index += 1;
    this.restartCapture();
  }

  private restartCapture() {
    this.buffer.reset();
    this.stopper?.();
    this.startCapture();
  }
}
