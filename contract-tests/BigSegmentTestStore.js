import got from 'got';

export default class BigSegmentTestStore {
  /**
   * Create a big segment test store suitable for use with the contract tests.
   * @param {string} callbackUri Uri on the test service to direct big segments
   * calls to.
   */
  constructor(callbackUri) {
    this._callbackUri = callbackUri;
  }

  async getMetadata() {
    const data = await got.get(`${this._callbackUri}/getMetadata`, { retry: { limit: 0 } }).json();
    return data;
  }

  async getUserMembership(contextHash) {
    const data = await got.post(`${this._callbackUri}/getMembership`, {
      retry: { limit: 0 },
      json: {
        contextHash
      }
    }).json();
    return data?.values;
  }

  close() { }
}
