import * as http from 'http';

import { platform } from '@launchdarkly/js-server-sdk-common';

import HeaderWrapper from './HeaderWrapper';

export default class NodeResponse implements platform.Response {
  incomingMessage: http.IncomingMessage;

  body: any[] = [];

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
      res.on('data', (chunk) => {
        this.body.push(chunk);
      });

      res.on('error', (err) => {
        this.rejection = err;
        if (this.listened) {
          reject(err);
        }
      });

      res.on('end', () => {
        resolve(Buffer.concat(this.body).toString());
      });
    });
  }

  private async wrappedWait(): Promise<string> {
    this.listened = true;
    if (this.rejection) {
      throw this.rejection;
    }
    return this.promise;
  }

  text(): Promise<string> {
    return this.wrappedWait();
  }

  async json(): Promise<any> {
    const stringValue = await this.wrappedWait();
    return JSON.parse(stringValue);
  }
}
