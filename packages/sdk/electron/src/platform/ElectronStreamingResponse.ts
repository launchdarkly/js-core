import * as http from 'http';

import { platform } from '@launchdarkly/js-client-sdk-common';

import HeaderWrapper from './HeaderWrapper';

/**
 * A response for a streaming request. It does not buffer the body: each read hands out the next
 * chunk from the socket. The `text` and `json` methods read the remainder of the stream, so a
 * caller uses either the reader or those methods, not both.
 */
export default class ElectronStreamingResponse implements platform.Response {
  headers: platform.Headers;

  status: number;

  statusText: string;

  body: platform.ResponseBody;

  private _iterator: AsyncIterableIterator<any>;

  constructor(res: http.IncomingMessage) {
    this.headers = new HeaderWrapper(res.headers);
    this.status = res.statusCode ?? 0;
    this.statusText = res.statusMessage ?? '';
    // The async iterator hands out one chunk per read. It resolves done when the server ends the
    // stream, and it rejects when the connection drops or the request is destroyed.
    const iterator = res[Symbol.asyncIterator]();
    this._iterator = iterator;
    this.body = {
      getReader: () => ({
        read: async () => {
          const next = await iterator.next();
          if (next.done) {
            return { done: true };
          }
          return { done: false, value: next.value };
        },
      }),
    };
  }

  async text(): Promise<string> {
    const chunks: Uint8Array[] = [];
    for await (const chunk of this._iterator) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString();
  }

  async json(): Promise<any> {
    return JSON.parse(await this.text());
  }
}
