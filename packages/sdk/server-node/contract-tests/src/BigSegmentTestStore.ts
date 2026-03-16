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
    const response = await fetch(`${this._callbackUri}/getMetadata`);
    if (!response.ok) {
      throw new Error(`getMetadata request failed with status ${response.status}`);
    }
    const data = await response.json();
    return data as BigSegmentMetadata;
  }

  async getUserMembership(contextHash: string): Promise<Record<string, boolean> | undefined> {
    const response = await fetch(`${this._callbackUri}/getMembership`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contextHash }),
    });
    if (!response.ok) {
      throw new Error(`getUserMembership request failed with status ${response.status}`);
    }
    const data = await response.json();
    return (data as BigSegmentMembership)?.values;
  }

  close(): void {}
}
