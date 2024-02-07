import * as fs from 'fs';
import * as http from 'http';
import { pipeline, Writable } from 'stream';
import * as zlib from 'zlib';

import { platform } from '@launchdarkly/js-server-sdk-common';

import HeaderWrapper from './HeaderWrapper';

export default class NodeResponse implements platform.Response {
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
          return reject(err);
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

  text(): Promise<string> {
    return this.promise;
  }

  async json(): Promise<any> {
    const stringValue = await this.promise;
    return JSON.parse(stringValue);
  }
}
