export default class EventBuffer {
  public content: any[] = [];
  private _size: number;

  constructor(size: number) {
    this._size = size;
  }

  push(item: any): void {
    if (this.content.length < this._size) {
      this.content.push(item);
    }
    // TODO: Log (SDK-915, SDK-973)
  }

  hasSpace(): boolean {
    return this.content.length < this._size;
  }

  isPopulated(): boolean {
    return this.content.length !== 0;
  }

  clear(): void {
    // TODO: Re-use the buffer. Keep write index instead of pushing. (SDK-972)
    this.content = [];
  }
}
