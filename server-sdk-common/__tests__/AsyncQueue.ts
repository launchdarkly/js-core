export class AsyncQueue {
  private content: any[] = [];
  private takers: {
    resolve: (res: any) => void;
    reject: (err: Error) => void;
  }[] = [];

  push(item: any) {
    if (this.takers.length) {
      const taker = this.takers.shift();
      taker?.resolve(item);
    }
    this.content.push(item);
  }

  take(): Promise<any> {
    if (this.content.length) {
      return Promise.resolve(this.content.shift()!);
    }

    return new Promise((resolve, reject) => {
      this.takers.push({ resolve, reject });
    });
  }

  empty() {
    return this.content.length === 0;
  }
}
