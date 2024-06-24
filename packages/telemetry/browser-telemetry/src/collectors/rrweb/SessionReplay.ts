/* eslint-disable max-classes-per-file */
import * as rrweb from 'rrweb';

import { BrowserTelemetry } from '../../api/BrowserTelemetry';
import { Collector } from '../../api/Collector';
import applyPatches from './patches';
import SessionBuffer from './SessionBuffer';

/**
 * Experimental capture of sessions using rrweb.
 */
export default class SessionReplay implements Collector {
  telemetry?: BrowserTelemetry;
  buffer: SessionBuffer;

  constructor(checkoutEveryNth: number, numBuffers: number) {
    applyPatches();
    this.buffer = new SessionBuffer(checkoutEveryNth, numBuffers);
    const { buffer } = this;
    rrweb.record({
      checkoutEveryNth,
      emit(event) {
        buffer.push(event);
      },
    });
  }

  register(telemetry: BrowserTelemetry): void {
    this.telemetry = telemetry;
  }

  unregister(): void {
    this.telemetry = undefined;
  }

  capture(): void {
    this.telemetry?.captureSession({
      id: crypto.randomUUID(),
      events: this.buffer.toArray(),
    });
  }
}
