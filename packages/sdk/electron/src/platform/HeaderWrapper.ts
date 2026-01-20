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
    // eslint-disable-next-line no-restricted-syntax
    for (const key of this.keys()) {
      const val = this.get(key);
      if (val !== null) {
        yield val;
      }
    }
  }

  *entries(): Iterable<[string, string]> {
    // eslint-disable-next-line no-restricted-syntax
    for (const key of this.keys()) {
      const val = this.get(key);
      if (val !== null) {
        yield [key, val];
      }
    }
  }

  has(name: string): boolean {
    return Object.prototype.hasOwnProperty.call(this._headers, name);
  }
}
