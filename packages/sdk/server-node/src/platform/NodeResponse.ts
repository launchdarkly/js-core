import * as http from 'http';
import * as zlib from 'zlib';
import { pipeline, Writable } from 'stream';

import { platform } from '@launchdarkly/js-server-sdk-common';

import HeaderWrapper from './HeaderWrapper';

/**
 * Memory stream for used to allow pipelining with decompression.
 * 
 * This implementation is not general purpose.
 */
class MemoryStream extends Writable {
  private chunks: any[] = [];

  override _write(chunk: any, _encoding: BufferEncoding, _onError: (error?: Error | null) => void) {
    this.chunks.push(chunk);
  }

  override toString() {
    return Buffer.concat(this.chunks).toString()
  }

  override end(cb?: (() => void) | undefined): this;
  override end(chunk: any, cb?: (() => void) | undefined): this;
  override end(chunk: any, encoding: BufferEncoding, cb?: (() => void) | undefined): this;
  override end(chunk?: unknown, encoding?: unknown, cb?: unknown): this {
    this._write(chunk, encoding as BufferEncoding, cb as (error?: Error | null) => void);
    this.emit('finish');
    return this;
  }
}

export default class NodeResponse implements platform.Response {
  incomingMessage: http.IncomingMessage;

  memoryStream: MemoryStream = new MemoryStream();

  promise: Promise<string>;

  headers: platform.Headers;

  status: number;

  constructor(res: http.IncomingMessage) {
    this.headers = new HeaderWrapper(res.headers);
    // Status code is optionally typed, but will always be present for this
    // use case.
    this.status = res.statusCode || 0;
    this.incomingMessage = res;



    this.promise = new Promise((resolve, reject) => {
      // Called on error or completion of the pipeline.
      const pipelineCallback = (err: any) => {
        if(err) {
          reject(err);
        }
        resolve(this.memoryStream.toString());
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

  text(): Promise<string> {
    return this.promise;
  }

  async json(): Promise<any> {
    const stringValue = await this.promise;
    return JSON.parse(stringValue);
  }
}
