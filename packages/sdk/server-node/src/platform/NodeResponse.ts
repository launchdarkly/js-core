import * as http from 'http';

import { platform } from '@launchdarkly/js-server-sdk-common';

import HeaderWrapper from './HeaderWrapper';

export default class NodeResponse implements platform.Response {
  incomingMessage: http.IncomingMessage;

  body: any[] = [];

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
      res.on('data', (chunk) => {
        this.body.push(chunk);
      });

      res.on('error', (err) => {
        reject(err);
      });

      res.on('end', () => {
        resolve(Buffer.concat(this.body).toString());
      });
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
