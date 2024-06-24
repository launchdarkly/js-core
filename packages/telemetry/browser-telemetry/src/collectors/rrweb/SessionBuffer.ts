import EventBuffer from './EventBuffer';

export default class SessionBuffer {
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
