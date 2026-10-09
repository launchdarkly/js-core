import * as http from 'http';

import { platform } from '@launchdarkly/js-client-sdk-common';

/**
 * Wraps the headers to match those used by fetch APIs.
 * @internal
 */
export default class HeaderWrapper implements platform.Headers {
  private _headers: http.IncomingHttpHeaders;

  constructor(headers: http.IncomingHttpHeaders) {
    this._headers = headers;
  }

  private _headerVal(name: string) {
    const val = this._headers[name];
    if (val === undefined || val === null) {
      return null;
    }
    if (Array.isArray(val)) {
      return val.join(', ');
    }
    return val;
  }

  get(name: string): string | null {
    return this._headerVal(name);
  }

  keys(): Iterable<string> {
    return Object.keys(this._headers);
  }

  // We want to use generators here for the simplicity of maintaining
  // this interface. Also they aren't expected to be high frequency usage.
  *values(): Iterable<string> {
    for (const key of this.keys()) {
      const val = this.get(key);
      if (val !== null) {
        yield val;
      }
    }
  }

  *entries(): Iterable<[string, string]> {
    for (const key of this.keys()) {
      const val = this.get(key);
      if (val !== null) {
        yield [key, val];
      }
    }
  }

  /**
   * Executes the callback once for each header, with the value first. The order matches the
   * fetch `Headers.forEach` signature. Multi-value headers are joined with a comma, and
   * headers without a value are skipped, like `entries`.
   */
  forEach(callback: (value: string, key: string) => void): void {
    for (const [key, value] of this.entries()) {
      callback(value, key);
    }
  }

  has(name: string): boolean {
    return Object.prototype.hasOwnProperty.call(this._headers, name);
  }
}
