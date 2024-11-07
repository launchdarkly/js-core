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
