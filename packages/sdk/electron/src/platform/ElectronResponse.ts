import * as http from 'http';
import { pipeline, Writable } from 'stream';
import * as zlib from 'zlib';

import { platform } from '@launchdarkly/js-client-sdk-common';

import HeaderWrapper from './HeaderWrapper';

export default class ElectronResponse implements platform.Response {
  incomingMessage: http.IncomingMessage;

  chunks: any[] = [];

  memoryStream: Writable = new Writable({
    decodeStrings: true,
    write: (chunk, _enc, next) => {
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
    // Status code is optionally typed, but will always be present for this
    // use case.
    this.status = res.statusCode || 0;
    this.incomingMessage = res;

    this.promise = new Promise((resolve, reject) => {
      // Called on error or completion of the pipeline.
      const pipelineCallback = (err: any) => {
        if (err) {
          this.rejection = err;
          if (this.listened) {
            reject(err);
          }
        }
        return resolve(Buffer.concat(this.chunks).toString());
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
