import got from 'got';

interface BigSegmentMetadata {
  lastUpToDate?: number;
}

interface BigSegmentMembership {
  values?: Record<string, boolean>;
}

export default class BigSegmentTestStore {
  private _callbackUri: string;

  /**
   * Create a big segment test store suitable for use with the contract tests.
   * @param callbackUri Uri on the test service to direct big segments calls to.
   */
  constructor(callbackUri: string) {
    this._callbackUri = callbackUri;
  }

  async getMetadata(): Promise<BigSegmentMetadata> {
    const data = await got.get(`${this._callbackUri}/getMetadata`, { retry: { limit: 0 } }).json();
    return data as BigSegmentMetadata;
  }

  async getUserMembership(contextHash: string): Promise<Record<string, boolean> | undefined> {
    const data = await got
      .post(`${this._callbackUri}/getMembership`, {
        retry: { limit: 0 },
        json: {
          contextHash,
        },
      })
      .json();
    return (data as BigSegmentMembership)?.values;
  }

  close(): void {}
}
