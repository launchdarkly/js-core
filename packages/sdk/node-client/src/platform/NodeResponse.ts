import * as http from 'http';
import { pipeline, Writable } from 'stream';
import * as zlib from 'zlib';

import { platform } from '@launchdarkly/js-client-sdk-common';

import HeaderWrapper from './HeaderWrapper';

// Upper bound on a buffered response body. Flag and event responses are far smaller than this;
// the cap prevents a misbehaving or hostile endpoint from exhausting memory with a huge body.
const MAX_RESPONSE_BYTES = 100 * 1024 * 1024;

export default class NodeResponse implements platform.Response {
  incomingMessage: http.IncomingMessage;

  chunks: any[] = [];

  private _totalBytes: number = 0;

  memoryStream: Writable = new Writable({
    decodeStrings: true,
    write: (chunk, _enc, next) => {
      this._totalBytes += chunk.length;
      if (this._totalBytes > MAX_RESPONSE_BYTES) {
        next(new Error(`Response body exceeded maximum size of ${MAX_RESPONSE_BYTES} bytes`));
        return;
      }
      this.chunks.push(chunk);
      next();
    },
  });

  promise: Promise<string>;

  headers: platform.Headers;

  status: number;

  listened: boolean = false;
  rejection?: Error;

  constructor(res: http.IncomingMessage) {
    this.headers = new HeaderWrapper(res.headers);
    // Status code is optionally typed, but will always be present for this use case.
    this.status = res.statusCode || 0;
    this.incomingMessage = res;

    this.promise = new Promise((resolve, reject) => {
      const pipelineCallback = (err: any) => {
        if (err) {
          this.rejection = err;
          if (this.listened) {
            reject(err);
          }
        } else {
          resolve(Buffer.concat(this.chunks).toString());
        }
      };
      switch (res.headers['content-encoding']) {
        case 'gzip':
          pipeline(res, zlib.createGunzip(), this.memoryStream, pipelineCallback);
          break;
        default:
          pipeline(res, this.memoryStream, pipelineCallback);
          break;
      }
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
