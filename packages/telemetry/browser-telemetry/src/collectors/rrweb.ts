/* eslint-disable max-classes-per-file */
import * as rrweb from 'rrweb';

import { BrowserTelemetry } from '../api/BrowserTelemetry';
import { Collector } from '../api/Collector';

export class EventBuffer {
  public content: any[] = [];
  private size: number;

  constructor(size: number) {
    this.size = size;
  }

  push(item: any): void {
    if (this.content.length < this.size) {
      this.content.push(item);
    }
    // TODO: Something?
  }

  hasSpace(): boolean {
    return this.content.length < this.size;
  }

  isPopulated(): boolean {
    return this.content.length !== 0;
  }

  clear(): void {
    // TODO: Re-use the buffer. Keep write index instead of pushing.
    this.content = [];
  }
}

export class SessionBuffer {
  private buffers: EventBuffer[] = [];
  private writePointer: number = 0;
  private headPointer: number = 0;

  constructor(bufferSize: number, numBuffers: number) {
    for (let index = 0; index < numBuffers; index += 1) {
      this.buffers.push(new EventBuffer(bufferSize));
    }
  }

  push(item: any): void {
    const buffer = this.buffers[this.writePointer];
    if (!buffer.hasSpace()) {
      if (this.writePointer < this.buffers.length - 1) {
        this.writePointer += 1;
      } else {
        this.writePointer = 0;
      }
      this.buffers[this.writePointer].clear();
      if (this.writePointer === this.headPointer) {
        this.headPointer += 1;
        if (this.headPointer >= this.buffers.length - 1) {
          this.headPointer = 0;
        }
      }
      this.push(item);
      return;
    }
    buffer.push(item);
  }

  toArray(): any[] {
    const asArray: any[] = [];
    const size = this.buffers.reduce((acc: number, item: EventBuffer) => {
      if (item.isPopulated()) {
        return acc + 1;
      }
      return acc;
    }, 0);

    for (let index = this.headPointer; index < this.headPointer + size; index += 1) {
      const realIndex = index % this.buffers.length;
      asArray.push(...this.buffers[realIndex].content);
    }

    return asArray;
  }
}

export default class Session implements Collector {
  telemetry?: BrowserTelemetry;
  buffer: SessionBuffer;

  constructor(checkoutEveryNth: number, numBuffers: number) {
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
      type: 'sessionCapture',
      id: crypto.randomUUID(),
      events: this.buffer.toArray(),
    });
  }
}
