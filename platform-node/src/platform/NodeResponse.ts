// eslint-disable-next-line max-classes-per-file
import { Headers, Response } from '@launchdarkly/js-server-sdk-common/dist/platform/Requests';
import * as http from 'http';

class HeaderWrapper implements Headers {
  private headers: http.IncomingHttpHeaders;

  constructor(headers: http.IncomingHttpHeaders) {
    this.headers = headers;
  }

  private headerVal(name: string) {
    const val = this.headers[name];
    if (val === undefined || val === null) {
      return null;
    }
    if (Array.isArray(val)) {
      return val.join(', ');
    }
    return val;
  }

  get(name: string): string | null {
    return this.headerVal(name);
  }

  keys(): Iterable<string> {
    return Object.keys(this.headers);
  }

  // We want to use generators here for the simplicity of maintaining
  // this interface. Also they aren't expected to be high frequency usage.

  * values(): Iterable<string> {
    // eslint-disable-next-line no-restricted-syntax
    for (const key of this.keys()) {
      const val = this.get(key);
      if (val !== null) {
        yield val;
      }
    }
  }

  * entries(): Iterable<[string, string]> {
    // eslint-disable-next-line no-restricted-syntax
    for (const key of this.keys()) {
      const val = this.get(key);
      if (val !== null) {
        yield [key, val];
      }
    }
  }

  has(name: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.headers, name);
  }
}

export default class NodeResponse implements Response {
  incomingMessage: http.IncomingMessage;

  body: any[] = [];

  promise: Promise<string>;

  headers: Headers;

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
