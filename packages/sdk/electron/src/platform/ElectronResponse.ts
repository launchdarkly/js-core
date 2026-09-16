import type { IncomingMessage } from 'electron';

import { platform } from '@launchdarkly/js-client-sdk-common';

import HeaderWrapper from './HeaderWrapper';

export default class ElectronResponse implements platform.Response {
  incomingMessage: IncomingMessage;

  chunks: Buffer[] = [];

  promise: Promise<string>;

  headers: platform.Headers;

  status: number;

  listened: boolean = false;
  rejection?: Error;

  // Electron's net module response object implements the Readable-stream 'data'/'end'
  // events. Its TypeScript declarations aren't a `stream.Readable`, so it isn't type-compatible
  // with `stream.pipeline()` the way `http.IncomingMessage` is -- collect chunks manually instead.
  constructor(res: IncomingMessage) {
    this.headers = new HeaderWrapper(res.headers);
    this.status = res.statusCode;
    this.incomingMessage = res;

    this.promise = new Promise((resolve, reject) => {
      let settled = false;

      // Called on error, abort, or completion of the response. Idempotent: only the first
      // call has any effect, since a body already resolved from 'end' should not be retroactively
      // poisoned by a late 'error'/'aborted' that fires after the transaction is otherwise done.
      const finish = (err?: unknown) => {
        if (settled) {
          return;
        }
        settled = true;
        if (err) {
          this.rejection = err instanceof Error ? err : new Error(String(err));
          if (this.listened) {
            reject(this.rejection);
            return;
          }
        }
        resolve(Buffer.concat(this.chunks).toString());
      };

      // The `net` module's response object transparently decompresses a compressed body --
      // `res.headers['content-encoding']` still reports the origin's original encoding (e.g.
      // 'gzip'), but the bytes delivered via 'data' are already plaintext. Do not re-decode them.
      res.on('data', (chunk: Buffer) => {
        this.chunks.push(chunk);
      });
      res.on('error', finish);
      res.on('aborted', () => finish(new Error('Response aborted')));
      res.on('end', () => finish());
    });
  }

  private async _wrappedWait(): Promise<string> {
    this.listened = true;
    if (this.rejection) {
      throw this.rejection;
    }
    return this.promise;
  }

  text(): Promise<string> {
    return this._wrappedWait();
  }

  async json(): Promise<any> {
    const stringValue = await this._wrappedWait();
    return JSON.parse(stringValue);
  }
}
