/* eslint-disable max-classes-per-file */
import * as rrweb from 'rrweb';

import { BrowserTelemetry } from '../../api/BrowserTelemetry';
import { Collector } from '../../api/Collector';
import applyPatches from './patches';
import SessionBuffer from './SessionBuffer';

interface RollingCapture {
  type: 'rolling';
  eventSegmentLength: number;
  segmentBufferLength: number;
}

interface ContinuousCapture {
  type: 'continuous';
  interval: number;
}

interface SessionReplayOptions {
  capture?: RollingCapture | ContinuousCapture;
}

function isRollingCapture(capture: unknown): capture is RollingCapture {
  return (capture as {type: string}).type === 'rolling';
}

function isContinuousCapture(capture: unknown): capture is ContinuousCapture {
  return (capture as {type: string}).type === 'continuous';
}

class RollingReplay implements Collector {
  telemetry?: BrowserTelemetry;
  buffer: SessionBuffer;
  stopper?: () => void;

  constructor(options: RollingCapture) {
    applyPatches();
    this.buffer = new SessionBuffer(options.eventSegmentLength, options.segmentBufferLength);

    this.startCapture();
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

  private startCapture() {
    const { buffer, checkoutEveryNth } = this;
    this.stopper = rrweb.record({
      checkoutEveryNth,
      emit(event) {
        buffer.push(event);
      },
    });
  }

  private reset() {
    this.stopper?.();
    this.buffer.reset();
    this.startCapture();
  }
}

class ContinuousReplay implements Collector {}

/**
 * Experimental capture of sessions using rrweb.
 */
export default class SessionReplay implements Collector {
  telemetry?: BrowserTelemetry;
  buffer: SessionBuffer;
  stopper?: () => void;

  constructor(options: SessionReplayOptions) {
    applyPatches();
    this.buffer = new SessionBuffer(checkoutEveryNth, numBuffers);

    this.startCapture();
    if (continuous) {
    }
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

  private startCapture() {
    const { buffer, checkoutEveryNth } = this;
    this.stopper = rrweb.record({
      checkoutEveryNth,
      emit(event) {
        buffer.push(event);
      },
    });
  }

  private reset() {
    this.stopper?.();
    this.buffer.reset();
    this.startCapture();
  }
}
