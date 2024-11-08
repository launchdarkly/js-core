const { TextEncoder, TextDecoder } = require('node:util');
const crypto = require('node:crypto');

global.TextEncoder = TextEncoder;

Object.assign(window, { TextDecoder, TextEncoder });

// Mock fetch if not defined in the test environment
if (!window.fetch) {
  Object.defineProperty(window, 'fetch', {
    value: jest.fn(),
    writable: true,
    configurable: true,
  });
}

// When mocking fetches we need response to be defined so we can check if a given
// value is an instance of response.
Object.defineProperty(global, 'Response', {
  value: class Response {
    constructor(body, init = {}) {
      this.body = body;
      this.status = init.status || 200;
      this.ok = this.status >= 200 && this.status < 300;
      this.statusText = init.statusText || '';
      this.headers = new Map(Object.entries(init.headers || {}));
    }

    async json() {
      return JSON.parse(this.body);
    }

    async text() {
      return String(this.body);
    }
  },
  writable: true,
  configurable: true,
});

// We need a global request to validate the fetch argument processing.
Object.defineProperty(global, 'Request', {
  value: class Request {
    constructor(input, init = {}) {
      this.url = typeof input === 'string' ? input : input.url;
      this.method = (init.method || 'GET').toUpperCase();
      this.headers = new Map(Object.entries(init.headers || {}));
      this.body = init.body || null;
      this.mode = init.mode || 'cors';
      this.credentials = init.credentials || 'same-origin';
      this.cache = init.cache || 'default';
      this.redirect = init.redirect || 'follow';
      this.referrer = init.referrer || 'about:client';
      this.integrity = init.integrity || '';
    }

    clone() {
      return new Request(this.url, {
        method: this.method,
        headers: Object.fromEntries(this.headers),
        body: this.body,
        mode: this.mode,
        credentials: this.credentials,
        cache: this.cache,
        redirect: this.redirect,
        referrer: this.referrer,
        integrity: this.integrity
      });
    }
  },
  writable: true,
  configurable: true,
});


// Based on:
// https://stackoverflow.com/a/71750830

Object.defineProperty(global.self, 'crypto', {
  value: {
    getRandomValues: (arr) => crypto.randomBytes(arr.length),
    subtle: {
      digest: (algorithm, data) => {
        return new Promise((resolve) =>
          resolve(
            crypto.createHash(algorithm.toLowerCase().replace('-', '')).update(data).digest(),
          ),
        );
      },
    },
  },
});
