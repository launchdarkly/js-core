export default class EventBuffer {
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
