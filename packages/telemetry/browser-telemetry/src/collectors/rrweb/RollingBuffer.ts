import EventBuffer from './EventBuffer';

/**
 * A session buffer is a circular buffer of buffers. Each buffer has a fixed size and is intended
 * to match the "checkout" size of rrweb. Each individual buffer should contain a valid replay
 * and then the sum of all the buffers should also be a valid replay containing each of the other
 * session chunks.
 *
 * The buffer can continuously capture events while always remaining in a playable state
 * and dropping old events.
 */
export default class RollingBuffer {
  private _buffers: EventBuffer[] = [];
  private _writePointer: number = 0;
  private _headPointer: number = 0;

  constructor(bufferSize: number, numBuffers: number) {
    for (let index = 0; index < numBuffers; index += 1) {
      this._buffers.push(new EventBuffer(bufferSize));
    }
  }

  push(item: any): void {
    const buffer = this._buffers[this._writePointer];
    if (!buffer.hasSpace()) {
      if (this._writePointer < this._buffers.length - 1) {
        this._writePointer += 1;
      } else {
        this._writePointer = 0;
      }
      this._buffers[this._writePointer].clear();
      if (this._writePointer === this._headPointer) {
        this._headPointer += 1;
        if (this._headPointer >= this._buffers.length - 1) {
          this._headPointer = 0;
        }
      }
      this.push(item);
      return;
    }
    buffer.push(item);
  }

  toArray(): any[] {
    const asArray: any[] = [];
    const size = this._buffers.reduce((acc: number, item: EventBuffer) => {
      if (item.isPopulated()) {
        return acc + 1;
      }
      return acc;
    }, 0);

    for (let index = this._headPointer; index < this._headPointer + size; index += 1) {
      const realIndex = index % this._buffers.length;
      asArray.push(...this._buffers[realIndex].content);
    }

    return asArray;
  }

  reset(): void {
    this._writePointer = 0;
    this._headPointer = 0;
    this._buffers.forEach((buffer) => buffer.clear());
  }
}
